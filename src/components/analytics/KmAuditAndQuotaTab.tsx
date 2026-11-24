import React, { useMemo, useState } from 'react';
import { parseISO, isValid, getDaysInMonth } from 'date-fns';
import { TripRequest, Vehicle, Driver, Contractor, City } from '../../types';
import { safeFormatDate } from '../../utils/dateUtils';
import {
  AlertTriangle,
  CheckCircle2,
  Gauge,
  Milestone,
  Truck,
  ShieldAlert,
  TrendingUp,
  Save,
  Check,
  Filter,
  Route,
  Calendar,
} from 'lucide-react';

interface KmAuditAndQuotaTabProps {
  trips: TripRequest[];
  filteredTrips: TripRequest[];
  vehicles: Vehicle[];
  drivers: Driver[];
  contractors: Contractor[];
  cities: City[];
  selectedYear: string;
  selectedMonth: string; // 'ALL' or '0'..'11'
}

interface QuotaConfig {
  defaultVehicleMonthlyKm: number;
  alertThresholdPercent: number; // padrão 75%
  vehicleQuotas: Record<string, number>; // vehicleId -> km/mês
}

const QUOTA_STORAGE_KEY = 'sigfrota_contractor_km_quotas_v1';
const DEFAULT_QUOTA_CONFIG: QuotaConfig = {
  defaultVehicleMonthlyKm: 3000,
  alertThresholdPercent: 75,
  vehicleQuotas: {},
};

const MONTHS_PT = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

function loadQuotaConfig(): QuotaConfig {
  try {
    const raw = localStorage.getItem(QUOTA_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        defaultVehicleMonthlyKm:
          Number(parsed.defaultVehicleMonthlyKm) > 0
            ? Number(parsed.defaultVehicleMonthlyKm)
            : DEFAULT_QUOTA_CONFIG.defaultVehicleMonthlyKm,
        alertThresholdPercent:
          Number(parsed.alertThresholdPercent) > 0
            ? Number(parsed.alertThresholdPercent)
            : DEFAULT_QUOTA_CONFIG.alertThresholdPercent,
        vehicleQuotas: parsed.vehicleQuotas && typeof parsed.vehicleQuotas === 'object' ? parsed.vehicleQuotas : {},
      };
    }
  } catch {
    // ignore
  }
  return DEFAULT_QUOTA_CONFIG;
}

function isOwnFleetContractor(contractor?: Contractor): boolean {
  if (!contractor) return false;
  if (contractor.id === 'cont-4') return true;
  const name = contractor.name.toLowerCase();
  return name.includes('frota própria') || name.includes('frota propria') || name.includes('própria / unilab');
}

export const KmAuditAndQuotaTab: React.FC<KmAuditAndQuotaTabProps> = ({
  trips,
  filteredTrips,
  vehicles,
  drivers,
  contractors,
  cities,
  selectedYear,
  selectedMonth,
}) => {
  const now = new Date();
  const [quotaConfig, setQuotaConfig] = useState<QuotaConfig>(() => loadQuotaConfig());
  const [savedNotice, setSavedNotice] = useState(false);

  // Mês de referência para o Termômetro de Franquia Mensal (quando o filtro global está em "ALL", usa o mês atual)
  const [quotaMonthOverride, setQuotaMonthOverride] = useState<number>(now.getMonth());
  const activeQuotaMonth = selectedMonth === 'ALL' ? quotaMonthOverride : parseInt(selectedMonth, 10);
  const activeQuotaYear = selectedYear === 'ALL' ? now.getFullYear() : parseInt(selectedYear, 10);

  // Filtro da Auditoria de Desvios
  const [onlyDeviations, setOnlyDeviations] = useState(false);
  const [deviationThreshold, setDeviationThreshold] = useState<number>(15); // ±15%
  const [selectedContractorFilter, setSelectedContractorFilter] = useState<string>('ALL');

  const persistQuotaConfig = (next: QuotaConfig) => {
    setQuotaConfig(next);
    try {
      localStorage.setItem(QUOTA_STORAGE_KEY, JSON.stringify(next));
      setSavedNotice(true);
      setTimeout(() => setSavedNotice(false), 2000);
    } catch {
      // ignore
    }
  };

  const getCityName = (id: string) => {
    const c = cities.find((item) => item.id === id);
    return c ? c.name : id;
  };

  const getDriverName = (id?: string) => {
    if (!id) return 'Não informado';
    const d = drivers.find((item) => item.id === id);
    return d ? d.name : id;
  };

  const getVehicleById = (id?: string) => vehicles.find((v) => v.id === id);

  // ============================================================================
  // PARTE 4: FRANQUIA MENSAL DOS VEÍCULOS DA CONTRATADA (ALERTA EM 75%)
  // ============================================================================
  const contractedContractors = useMemo(
    () => contractors.filter((c) => !isOwnFleetContractor(c)),
    [contractors]
  );

  const contractedVehicles = useMemo(() => {
    const contractedIds = new Set(contractedContractors.map((c) => c.id));
    return vehicles.filter((v) => v.is_active && v.contractor_id && contractedIds.has(v.contractor_id));
  }, [vehicles, contractedContractors]);

  // Viagens confirmadas do mês de referência da franquia
  const quotaMonthTrips = useMemo(() => {
    return trips.filter((t) => {
      if (t.status !== 'Confirmado ao Demandante') return false;
      try {
        const d = parseISO(t.departure_datetime);
        if (!isValid(d)) return false;
        return d.getMonth() === activeQuotaMonth && d.getFullYear() === activeQuotaYear;
      } catch {
        return false;
      }
    });
  }, [trips, activeQuotaMonth, activeQuotaYear]);

  // Estatísticas de franquia por veículo contratado
  const vehicleQuotaStats = useMemo(() => {
    const stats = contractedVehicles.map((v) => {
      const contractor = contractedContractors.find((c) => c.id === v.contractor_id);
      const vTrips = quotaMonthTrips.filter((t) => t.allocated_vehicle_id === v.id);
      const usedKm = Number(
        vTrips
          .reduce((acc, t) => acc + (t.real_km && t.real_km > 0 ? t.real_km : t.estimated_km || 0), 0)
          .toFixed(1)
      );
      const quotaKm =
        quotaConfig.vehicleQuotas[v.id] !== undefined && quotaConfig.vehicleQuotas[v.id] > 0
          ? quotaConfig.vehicleQuotas[v.id]
          : quotaConfig.defaultVehicleMonthlyKm;
      const usagePercent = quotaKm > 0 ? Number(((usedKm / quotaKm) * 100).toFixed(1)) : 0;
      const remainingKm = Number((quotaKm - usedKm).toFixed(1));

      let level: 'normal' | 'warning' | 'critical' | 'exceeded' = 'normal';
      if (usagePercent >= 100) level = 'exceeded';
      else if (usagePercent >= 95) level = 'critical';
      else if (usagePercent >= quotaConfig.alertThresholdPercent) level = 'warning';

      return {
        vehicle: v,
        contractor,
        tripsCount: vTrips.length,
        usedKm,
        quotaKm,
        usagePercent,
        remainingKm,
        level,
      };
    });

    return stats
      .filter((s) =>
        selectedContractorFilter === 'ALL' ? true : s.contractor?.id === selectedContractorFilter
      )
      .sort((a, b) => b.usagePercent - a.usagePercent || b.usedKm - a.usedKm);
  }, [contractedVehicles, contractedContractors, quotaMonthTrips, quotaConfig, selectedContractorFilter]);

  // Consolidado por Contratada
  const contractorQuotaSummary = useMemo(() => {
    const daysInMonth = getDaysInMonth(new Date(activeQuotaYear, activeQuotaMonth, 1));
    const isCurrentMonth =
      activeQuotaYear === now.getFullYear() && activeQuotaMonth === now.getMonth();
    const elapsedDays = isCurrentMonth ? Math.max(1, now.getDate()) : daysInMonth;

    return contractedContractors
      .map((c) => {
        const items = vehicleQuotaStats.filter((s) => s.contractor?.id === c.id);
        if (items.length === 0) return null;

        const usedKm = Number(items.reduce((acc, i) => acc + i.usedKm, 0).toFixed(1));
        const totalQuotaKm = Number(items.reduce((acc, i) => acc + i.quotaKm, 0).toFixed(1));
        const usagePercent = totalQuotaKm > 0 ? Number(((usedKm / totalQuotaKm) * 100).toFixed(1)) : 0;
        const remainingKm = Number((totalQuotaKm - usedKm).toFixed(1));
        const projectedKm = isCurrentMonth
          ? Number(((usedKm / elapsedDays) * daysInMonth).toFixed(0))
          : usedKm;
        const projectedPercent =
          totalQuotaKm > 0 ? Number(((projectedKm / totalQuotaKm) * 100).toFixed(1)) : 0;
        const vehiclesInAlert = items.filter((i) => i.usagePercent >= quotaConfig.alertThresholdPercent).length;

        return {
          contractor: c,
          vehicleCount: items.length,
          usedKm,
          totalQuotaKm,
          usagePercent,
          remainingKm,
          projectedKm,
          projectedPercent,
          vehiclesInAlert,
          isCurrentMonth,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
  }, [contractedContractors, vehicleQuotaStats, activeQuotaMonth, activeQuotaYear, quotaConfig.alertThresholdPercent]);

  const vehiclesAtAlert = useMemo(
    () => vehicleQuotaStats.filter((s) => s.usagePercent >= quotaConfig.alertThresholdPercent),
    [vehicleQuotaStats, quotaConfig.alertThresholdPercent]
  );

  // ============================================================================
  // PARTE 1: AUDITORIA DE DESVIOS — KM PREVISTO × KM REAL
  // ============================================================================
  const kmAuditRows = useMemo(() => {
    return filteredTrips
      .filter((t) => t.status === 'Confirmado ao Demandante' && t.real_km !== undefined && t.real_km !== null && t.real_km > 0)
      .map((t) => {
        const estimated = t.estimated_km || 0;
        const real = t.real_km || 0;
        const diffKm = Number((real - estimated).toFixed(1));
        const diffPct = estimated > 0 ? Number(((diffKm / estimated) * 100).toFixed(1)) : 0;
        const absPct = Math.abs(diffPct);
        const isAlert = absPct >= deviationThreshold;
        const vehicle = getVehicleById(t.allocated_vehicle_id);
        const routeLabel = `${getCityName(t.origin_city_id)} ➔ ${getCityName(t.destination_city_id)}`;

        return {
          trip: t,
          estimated,
          real,
          diffKm,
          diffPct,
          absPct,
          isAlert,
          vehicle,
          driverName: getDriverName(t.allocated_driver_id),
          routeLabel,
        };
      })
      .sort((a, b) => b.absPct - a.absPct || Math.abs(b.diffKm) - Math.abs(a.diffKm));
  }, [filteredTrips, deviationThreshold, vehicles, drivers, cities]);

  const displayedAuditRows = useMemo(
    () => (onlyDeviations ? kmAuditRows.filter((r) => r.isAlert) : kmAuditRows),
    [kmAuditRows, onlyDeviations]
  );

  const auditSummary = useMemo(() => {
    const totalEstimated = Number(kmAuditRows.reduce((acc, r) => acc + r.estimated, 0).toFixed(1));
    const totalReal = Number(kmAuditRows.reduce((acc, r) => acc + r.real, 0).toFixed(1));
    const totalDiff = Number((totalReal - totalEstimated).toFixed(1));
    const totalDiffPct = totalEstimated > 0 ? Number(((totalDiff / totalEstimated) * 100).toFixed(1)) : 0;
    const alertCount = kmAuditRows.filter((r) => r.isAlert).length;
    return { totalEstimated, totalReal, totalDiff, totalDiffPct, alertCount, count: kmAuditRows.length };
  }, [kmAuditRows]);

  // Desvio médio por rota (sugere calibração da Matriz de Distâncias)
  const routeDeviations = useMemo(() => {
    const map = new Map<
      string,
      { route: string; trips: number; sumEst: number; sumReal: number }
    >();
    kmAuditRows.forEach((r) => {
      const cur = map.get(r.routeLabel) || { route: r.routeLabel, trips: 0, sumEst: 0, sumReal: 0 };
      cur.trips += 1;
      cur.sumEst += r.estimated;
      cur.sumReal += r.real;
      map.set(r.routeLabel, cur);
    });

    return Array.from(map.values())
      .map((item) => {
        const avgEst = Number((item.sumEst / item.trips).toFixed(1));
        const avgReal = Number((item.sumReal / item.trips).toFixed(1));
        const avgDiffPct = avgEst > 0 ? Number((((avgReal - avgEst) / avgEst) * 100).toFixed(1)) : 0;
        return { ...item, avgEst, avgReal, avgDiffPct };
      })
      .sort((a, b) => Math.abs(b.avgDiffPct) - Math.abs(a.avgDiffPct))
      .slice(0, 6);
  }, [kmAuditRows]);

  const quotaMonthLabel = `${MONTHS_PT[activeQuotaMonth]} / ${activeQuotaYear}`;

  return (
    <div className="space-y-6">
      {/* ===================================================================== */}
      {/* BLOCO 1: FRANQUIA MENSAL DOS VEÍCULOS DA CONTRATADA (ALERTA EM 75%)   */}
      {/* ===================================================================== */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-4 sm:p-6 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <Gauge className="w-5 h-5 text-brand-600" />
              <h3 className="text-base sm:text-lg font-extrabold text-navy-950">
                Franquia Mensal de KM — Veículos da Contratada ({quotaMonthLabel})
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Acompanhamento de consumo mensal por placa contratada com alerta automático ao atingir{' '}
              <strong className="text-amber-700">{quotaConfig.alertThresholdPercent}%</strong> da franquia.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            {selectedMonth === 'ALL' && (
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-300 px-2.5 py-1.5 rounded-xl">
                <Calendar className="w-3.5 h-3.5 text-brand-600" />
                <select
                  value={quotaMonthOverride}
                  onChange={(e) => setQuotaMonthOverride(parseInt(e.target.value, 10))}
                  className="bg-transparent font-bold text-slate-800 focus:outline-hidden"
                >
                  {MONTHS_PT.map((label, idx) => (
                    <option key={label} value={idx}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-300 px-2.5 py-1.5 rounded-xl">
              <span className="text-slate-500 font-semibold">Franquia padrão/veículo:</span>
              <input
                type="number"
                min={100}
                step={100}
                value={quotaConfig.defaultVehicleMonthlyKm}
                onChange={(e) =>
                  persistQuotaConfig({
                    ...quotaConfig,
                    defaultVehicleMonthlyKm: Math.max(100, Number(e.target.value) || 3000),
                  })
                }
                className="w-20 font-extrabold text-navy-950 bg-white border border-slate-300 rounded-lg px-2 py-0.5 text-right"
              />
              <span className="text-slate-500 font-bold">km</span>
            </div>

            <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-300 px-2.5 py-1.5 rounded-xl">
              <span className="text-amber-800 font-semibold">Alerta em:</span>
              <input
                type="number"
                min={50}
                max={100}
                value={quotaConfig.alertThresholdPercent}
                onChange={(e) =>
                  persistQuotaConfig({
                    ...quotaConfig,
                    alertThresholdPercent: Math.min(100, Math.max(50, Number(e.target.value) || 75)),
                  })
                }
                className="w-14 font-extrabold text-amber-950 bg-white border border-amber-300 rounded-lg px-1.5 py-0.5 text-right"
              />
              <span className="text-amber-800 font-bold">%</span>
            </div>

            {savedNotice && (
              <span className="inline-flex items-center gap-1 text-emerald-700 font-bold bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-xl">
                <Check className="w-3.5 h-3.5" />
                Salvo
              </span>
            )}
          </div>
        </div>

        {/* Banner de Alerta Automático (≥ 75% da franquia mensal) */}
        {vehiclesAtAlert.length > 0 ? (
          <div className="rounded-2xl border-2 border-amber-400 bg-amber-50/90 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-amber-500 text-white shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-extrabold text-amber-950">
                  Atenção: {vehiclesAtAlert.length} veículo(s) da contratada atingiram ≥{' '}
                  {quotaConfig.alertThresholdPercent}% da franquia em {quotaMonthLabel}!
                </h4>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {vehiclesAtAlert.map((item) => (
                    <span
                      key={item.vehicle.id}
                      className={`text-[11px] font-extrabold px-2.5 py-0.5 rounded-full border ${
                        item.level === 'exceeded'
                          ? 'bg-rose-600 text-white border-rose-700'
                          : item.level === 'critical'
                          ? 'bg-rose-100 text-rose-900 border-rose-300'
                          : 'bg-amber-200/80 text-amber-950 border-amber-400'
                      }`}
                    >
                      {item.vehicle.plate}: {item.usagePercent}% ({item.usedKm}/{item.quotaKm} km)
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 px-4 py-3 flex items-center gap-2.5 text-xs text-emerald-900 font-semibold">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              Todos os veículos da contratada estão abaixo de {quotaConfig.alertThresholdPercent}% da
              franquia mensal em {quotaMonthLabel}.
            </span>
          </div>
        )}

        {/* Cards Consolidados por Contratada */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {contractorQuotaSummary.map((c) => {
            const isExceeded = c.usagePercent >= 100;
            const isWarning = c.usagePercent >= quotaConfig.alertThresholdPercent;
            const barColor = isExceeded
              ? 'bg-rose-600'
              : isWarning
              ? 'bg-amber-500'
              : 'bg-emerald-600';

            return (
              <div
                key={c.contractor.id}
                className={`rounded-2xl border p-4 space-y-3 ${
                  isExceeded
                    ? 'bg-rose-50/60 border-rose-300'
                    : isWarning
                    ? 'bg-amber-50/60 border-amber-300'
                    : 'bg-slate-50/70 border-slate-200'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                      Empresa Contratada • {c.vehicleCount} veículo(s)
                    </span>
                    <h4 className="text-xs font-extrabold text-navy-950 leading-snug mt-0.5">
                      {c.contractor.name}
                    </h4>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[11px] font-extrabold shrink-0 ${
                      isExceeded
                        ? 'bg-rose-600 text-white'
                        : isWarning
                        ? 'bg-amber-500 text-white'
                        : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    {c.usagePercent}%
                  </span>
                </div>

                {/* Barra de progresso com marca visual de 75% */}
                <div className="relative h-3 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${barColor}`}
                    style={{ width: `${Math.min(100, c.usagePercent)}%` }}
                  />
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-navy-950/70"
                    style={{ left: `${quotaConfig.alertThresholdPercent}%` }}
                    title={`Limiar de alerta: ${quotaConfig.alertThresholdPercent}%`}
                  />
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <span className="text-slate-400 block">KM Rodado / Franquia</span>
                    <strong className="text-navy-950">
                      {c.usedKm.toLocaleString('pt-BR')} / {c.totalQuotaKm.toLocaleString('pt-BR')} km
                    </strong>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-400 block">
                      {c.remainingKm >= 0 ? 'Saldo Disponível' : 'KM Excedente'}
                    </span>
                    <strong className={c.remainingKm >= 0 ? 'text-emerald-700' : 'text-rose-700'}>
                      {Math.abs(c.remainingKm).toLocaleString('pt-BR')} km
                    </strong>
                  </div>
                </div>

                {c.isCurrentMonth && (
                  <div className="pt-2 border-t border-slate-200/70 flex items-center justify-between text-[11px]">
                    <span className="text-slate-500 flex items-center gap-1">
                      <TrendingUp className="w-3.5 h-3.5 text-brand-600" />
                      Projeção fim do mês:
                    </span>
                    <strong
                      className={
                        c.projectedPercent >= 100
                          ? 'text-rose-700'
                          : c.projectedPercent >= quotaConfig.alertThresholdPercent
                          ? 'text-amber-700'
                          : 'text-slate-800'
                      }
                    >
                      {c.projectedKm.toLocaleString('pt-BR')} km ({c.projectedPercent}%)
                    </strong>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Tabela Detalhada por Veículo Contratado (com edição individual de franquia) */}
        <div className="space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
              <Truck className="w-4 h-4 text-brand-600" />
              <span>Franquia Individual por Veículo Contratado ({vehicleQuotaStats.length})</span>
            </h4>

            <select
              value={selectedContractorFilter}
              onChange={(e) => setSelectedContractorFilter(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-slate-300 bg-slate-50 text-xs font-semibold text-slate-700"
            >
              <option value="ALL">Todas as contratadas</option>
              {contractedContractors.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-2xl">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100/80 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                  <th className="p-3 pl-4">Placa / Veículo</th>
                  <th className="p-3">Contratada</th>
                  <th className="p-3 text-center">Viagens</th>
                  <th className="p-3 text-right">KM Rodado</th>
                  <th className="p-3 text-center">Franquia Mensal (KM)</th>
                  <th className="p-3 min-w-[180px]">Utilização (%)</th>
                  <th className="p-3 text-right">Saldo / Excedente</th>
                  <th className="p-3 pr-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {vehicleQuotaStats.map((item) => {
                  const barColor =
                    item.level === 'exceeded'
                      ? 'bg-rose-600'
                      : item.level === 'critical'
                      ? 'bg-rose-500'
                      : item.level === 'warning'
                      ? 'bg-amber-500'
                      : 'bg-emerald-500';

                  return (
                    <tr
                      key={item.vehicle.id}
                      className={`hover:bg-slate-50/80 ${
                        item.level === 'exceeded'
                          ? 'bg-rose-50/50'
                          : item.level === 'warning' || item.level === 'critical'
                          ? 'bg-amber-50/40'
                          : ''
                      }`}
                    >
                      <td className="p-3 pl-4 whitespace-nowrap">
                        <span className="font-mono font-extrabold text-navy-950 bg-slate-100 border border-slate-300 px-1.5 py-0.5 rounded mr-2">
                          {item.vehicle.plate}
                        </span>
                        <span className="font-semibold text-slate-700">{item.vehicle.type}</span>
                      </td>
                      <td className="p-3 text-slate-600 max-w-[200px] truncate">
                        {item.contractor?.name || '-'}
                      </td>
                      <td className="p-3 text-center font-bold text-slate-700">{item.tripsCount}</td>
                      <td className="p-3 text-right font-extrabold text-navy-950 whitespace-nowrap">
                        {item.usedKm.toLocaleString('pt-BR')} km
                      </td>
                      <td className="p-3 text-center">
                        <input
                          type="number"
                          min={100}
                          step={100}
                          value={item.quotaKm}
                          onChange={(e) => {
                            const val = Math.max(100, Number(e.target.value) || quotaConfig.defaultVehicleMonthlyKm);
                            persistQuotaConfig({
                              ...quotaConfig,
                              vehicleQuotas: {
                                ...quotaConfig.vehicleQuotas,
                                [item.vehicle.id]: val,
                              },
                            });
                          }}
                          className="w-24 px-2 py-1 text-right font-bold rounded-lg border border-slate-300 bg-white text-slate-800"
                          title="Clique para ajustar a franquia mensal específica desta placa"
                        />
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <div className="relative flex-1 h-2.5 bg-slate-200 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${barColor}`}
                              style={{ width: `${Math.min(100, item.usagePercent)}%` }}
                            />
                            <div
                              className="absolute top-0 bottom-0 w-0.5 bg-navy-950/60"
                              style={{ left: `${quotaConfig.alertThresholdPercent}%` }}
                            />
                          </div>
                          <span className="font-extrabold text-navy-950 w-12 text-right">
                            {item.usagePercent}%
                          </span>
                        </div>
                      </td>
                      <td className="p-3 text-right whitespace-nowrap font-bold">
                        <span className={item.remainingKm >= 0 ? 'text-emerald-700' : 'text-rose-700'}>
                          {item.remainingKm >= 0
                            ? `${item.remainingKm.toLocaleString('pt-BR')} km`
                            : `+${Math.abs(item.remainingKm).toLocaleString('pt-BR')} km exc.`}
                        </span>
                      </td>
                      <td className="p-3 pr-4 text-center whitespace-nowrap">
                        {item.level === 'exceeded' ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-600 text-white">
                            Excedido (&gt;100%)
                          </span>
                        ) : item.level === 'critical' ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-100 text-rose-800 border border-rose-300">
                            Crítico (≥95%)
                          </span>
                        ) : item.level === 'warning' ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300">
                            Alerta (≥{quotaConfig.alertThresholdPercent}%)
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Normal
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* BLOCO 2: AUDITORIA DE DESVIOS — KM PREVISTO × KM REAL                 */}
      {/* ===================================================================== */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-4 sm:p-6 space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-purple-600" />
              <h3 className="text-base sm:text-lg font-extrabold text-navy-950">
                Auditoria de Desvios: KM Previsto × KM Real
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Compara a quilometragem estimada pela matriz com o KM real lançado pelo motorista ou contratada, destacando desvios acima de ±{deviationThreshold}%.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-300 px-2.5 py-1.5 rounded-xl">
              <span className="text-slate-500 font-semibold">Tolerância: ±</span>
              <input
                type="number"
                min={5}
                max={50}
                value={deviationThreshold}
                onChange={(e) => setDeviationThreshold(Math.max(5, Math.min(50, Number(e.target.value) || 15)))}
                className="w-12 font-extrabold text-navy-950 bg-white border border-slate-300 rounded px-1.5 py-0.5 text-right"
              />
              <span className="font-bold text-slate-500">%</span>
            </div>

            <button
              type="button"
              onClick={() => setOnlyDeviations((prev) => !prev)}
              className={`px-3 py-1.5 rounded-xl font-bold border flex items-center gap-1.5 transition-colors ${
                onlyDeviations
                  ? 'bg-rose-600 text-white border-rose-700'
                  : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              <span>Apenas Desvios ≥ ±{deviationThreshold}% ({auditSummary.alertCount})</span>
            </button>
          </div>
        </div>

        {/* KPIs de Auditoria KM */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5">
            <span className="text-[10px] font-bold uppercase text-slate-400 block">Viagens com KM Real</span>
            <span className="text-xl font-extrabold text-navy-950 mt-0.5 block">{auditSummary.count}</span>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5">
            <span className="text-[10px] font-bold uppercase text-slate-400 block">KM Previsto × Real</span>
            <span className="text-sm font-extrabold text-navy-950 mt-1 block">
              {auditSummary.totalEstimated.toLocaleString('pt-BR')} →{' '}
              <span className="text-brand-700">{auditSummary.totalReal.toLocaleString('pt-BR')} km</span>
            </span>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5">
            <span className="text-[10px] font-bold uppercase text-slate-400 block">Variação Líquida</span>
            <span
              className={`text-xl font-extrabold mt-0.5 block ${
                Math.abs(auditSummary.totalDiffPct) >= deviationThreshold
                  ? 'text-rose-700'
                  : 'text-emerald-700'
              }`}
            >
              {auditSummary.totalDiff > 0 ? '+' : ''}
              {auditSummary.totalDiff.toLocaleString('pt-BR')} km ({auditSummary.totalDiffPct > 0 ? '+' : ''}
              {auditSummary.totalDiffPct}%)
            </span>
          </div>
          <div className="bg-rose-50/70 border border-rose-200 rounded-2xl p-3.5">
            <span className="text-[10px] font-bold uppercase text-rose-700 block">
              Alertas de Desvio (≥ ±{deviationThreshold}%)
            </span>
            <span className="text-xl font-extrabold text-rose-900 mt-0.5 block">
              {auditSummary.alertCount}
            </span>
          </div>
        </div>

        {/* Tabela de Viagens Auditadas */}
        {displayedAuditRows.length === 0 ? (
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-8 text-center text-xs text-slate-500">
            {auditSummary.count === 0
              ? 'Nenhuma viagem no período selecionado possui KM Real lançado ainda. Assim que os motoristas concluírem o check-out (ou o KM real for lançado), a auditoria aparecerá aqui.'
              : `Nenhuma viagem apresentou desvio acima de ±${deviationThreshold}% no período selecionado.`}
          </div>
        ) : (
          <div className="overflow-x-auto border border-slate-200 rounded-2xl">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100/80 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                  <th className="p-3 pl-4">Processo / Data</th>
                  <th className="p-3">Trecho / Rota</th>
                  <th className="p-3">Motorista / Placa</th>
                  <th className="p-3 text-right">KM Previsto</th>
                  <th className="p-3 text-right">KM Real</th>
                  <th className="p-3 text-center">Desvio</th>
                  <th className="p-3 pr-4">Observação do Motorista</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {displayedAuditRows.map((row) => {
                  const badgeCls =
                    row.absPct >= 30
                      ? 'bg-rose-600 text-white'
                      : row.absPct >= deviationThreshold
                      ? 'bg-amber-100 text-amber-900 border border-amber-300'
                      : 'bg-emerald-50 text-emerald-700 border border-emerald-200';

                  return (
                    <tr
                      key={row.trip.id}
                      className={`hover:bg-slate-50/80 ${row.isAlert ? 'bg-amber-50/30' : ''}`}
                    >
                      <td className="p-3 pl-4 whitespace-nowrap">
                        <div className="font-bold text-navy-950">{row.trip.process_number}</div>
                        <div className="text-[10px] text-slate-400">
                          {safeFormatDate(row.trip.departure_datetime, 'dd/MM/yyyy', '-')}
                        </div>
                      </td>
                      <td className="p-3 font-semibold text-slate-800 whitespace-nowrap">
                        {row.routeLabel}
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        <div className="font-bold text-slate-800">{row.driverName}</div>
                        <div className="text-[10px] font-mono text-slate-500">
                          {row.vehicle ? `${row.vehicle.plate} • ${row.vehicle.type}` : '-'}
                        </div>
                      </td>
                      <td className="p-3 text-right font-semibold text-slate-600 whitespace-nowrap">
                        {row.estimated} km
                      </td>
                      <td className="p-3 text-right whitespace-nowrap">
                        <div className="font-extrabold text-navy-950">{row.real} km</div>
                        {row.trip.odometer_start !== undefined && row.trip.odometer_end !== undefined && (
                          <div className="text-[10px] font-mono text-slate-400">
                            {row.trip.odometer_start} → {row.trip.odometer_end}
                          </div>
                        )}
                      </td>
                      <td className="p-3 text-center whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-extrabold ${badgeCls}`}>
                          {row.diffKm > 0 ? '+' : ''}
                          {row.diffKm} km ({row.diffPct > 0 ? '+' : ''}
                          {row.diffPct}%)
                        </span>
                      </td>
                      <td className="p-3 pr-4 text-slate-600 max-w-xs whitespace-pre-wrap">
                        {row.trip.report_notes?.trim() || '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Resumo por Rota para calibração da Matriz */}
        {routeDeviations.length > 0 && (
          <div className="pt-2 space-y-2.5">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
              <Route className="w-4 h-4 text-purple-600" />
              <span>Calibração da Matriz — Desvio Médio por Rota</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {routeDeviations.map((rd) => (
                <div
                  key={rd.route}
                  className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between gap-2 text-xs"
                >
                  <div className="min-w-0">
                    <div className="font-bold text-navy-950 truncate">{rd.route}</div>
                    <div className="text-[10px] text-slate-500">
                      {rd.trips} viagem(ns) • Matriz: {rd.avgEst} km → Real médio: {rd.avgReal} km
                    </div>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[11px] font-extrabold shrink-0 ${
                      Math.abs(rd.avgDiffPct) >= deviationThreshold
                        ? 'bg-amber-100 text-amber-900 border border-amber-300'
                        : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    }`}
                  >
                    {rd.avgDiffPct > 0 ? '+' : ''}
                    {rd.avgDiffPct}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
