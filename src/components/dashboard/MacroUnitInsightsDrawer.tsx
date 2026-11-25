import React, { useEffect, useMemo, useState } from 'react';
import {
  X,
  Building2,
  TrendingUp,
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Milestone,
  Users,
  MapPin,
  User,
  Star,
  BarChart3,
  Activity,
  ChevronRight,
} from 'lucide-react';
import { parseISO, isValid, getMonth, getYear, differenceInCalendarDays } from 'date-fns';
import { TripRequest } from '../../types';
import { DistanceService } from '../../services/distanceService';
import { FleetService } from '../../services/fleetService';
import { StatusBadge } from '../common/StatusBadge';
import { safeFormatDate } from '../../utils/dateUtils';

interface MacroUnitInsightsDrawerProps {
  selectedUnit: string | null;
  availableUnits: string[];
  scopedTrips: TripRequest[];
  allTrips: TripRequest[];
  periodLabel: string;
  onSelectUnit: (unit: string) => void;
  onClose: () => void;
  onSelectTripDetail: (trip: TripRequest) => void;
}

const SHORT_MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

export const MacroUnitInsightsDrawer: React.FC<MacroUnitInsightsDrawerProps> = ({
  selectedUnit,
  availableUnits,
  scopedTrips,
  allTrips,
  periodLabel,
  onSelectUnit,
  onClose,
  onSelectTripDetail,
}) => {
  const [scopeMode, setScopeMode] = useState<'period' | 'all'>('period');
  const [isVisible, setIsVisible] = useState(false);

  const cities = DistanceService.getCities();
  const unitsCatalog = FleetService.getUnits();

  // Animação fluida de entrada/saída
  useEffect(() => {
    if (selectedUnit) {
      const raf = requestAnimationFrame(() => setIsVisible(true));
      return () => cancelAnimationFrame(raf);
    } else {
      setIsVisible(false);
    }
  }, [selectedUnit]);

  // Fecha com ESC
  useEffect(() => {
    if (!selectedUnit) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleAnimatedClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [selectedUnit]);

  const handleAnimatedClose = () => {
    setIsVisible(false);
    setTimeout(() => onClose(), 220);
  };

  const getCityName = (id: string) => {
    const c = cities.find((item) => item.id === id);
    return c ? `${c.name}-${c.state}` : id;
  };

  const unitMeta = useMemo(() => {
    if (!selectedUnit) return undefined;
    return unitsCatalog.find(
      (u) => String(u.code).toUpperCase() === selectedUnit.toUpperCase()
    );
  }, [selectedUnit, unitsCatalog]);

  const baseDataset = scopeMode === 'period' ? scopedTrips : allTrips;

  const stats = useMemo(() => {
    if (!selectedUnit) return null;

    const unitTrips = baseDataset.filter(
      (t) => (t.macro_unit || '').toUpperCase() === selectedUnit.toUpperCase()
    );
    const total = unitTrips.length;
    const sharePct = baseDataset.length > 0 ? Math.round((total / baseDataset.length) * 100) : 0;

    const confirmed = unitTrips.filter((t) => t.status === 'Confirmado ao Demandante').length;
    const pending = unitTrips.filter((t) => t.status === 'Pendente de Análise').length;
    const rejected = unitTrips.filter((t) => t.status === 'Indeferido').length;
    const cancelled = unitTrips.filter((t) => t.status.includes('Cancelado')).length;

    const inDeadline = unitTrips.filter((t) => t.status_deadline === 'Dentro do Prazo').length;
    const outDeadline = total - inDeadline;
    const deadlineRate = total > 0 ? Math.round((inDeadline / total) * 100) : 0;
    const attendanceRate = total > 0 ? Math.round((confirmed / total) * 100) : 0;

    const avgAdvanceDays =
      total > 0
        ? Number(
            (unitTrips.reduce((acc, t) => acc + (Number(t.advance_days) || 0), 0) / total).toFixed(1)
          )
        : 0;

    const totalKm = Math.round(
      unitTrips
        .filter((t) => t.status === 'Confirmado ao Demandante')
        .reduce((acc, t) => acc + (t.real_km && t.real_km > 0 ? t.real_km : t.estimated_km || 0), 0)
    );
    const totalPassengers = unitTrips
      .filter((t) => t.status === 'Confirmado ao Demandante')
      .reduce((acc, t) => acc + (t.passenger_count || 0), 0);

    // Datas de recebimento / saída para médias mensais e diárias
    const parsedDates = unitTrips
      .map((t) => {
        const raw = t.received_at || t.departure_datetime;
        try {
          const d = parseISO(raw);
          return isValid(d) ? d : null;
        } catch {
          return null;
        }
      })
      .filter((d): d is Date => d !== null)
      .sort((a, b) => a.getTime() - b.getTime());

    const activeMonthKeys = new Set(
      parsedDates.map((d) => `${getYear(d)}-${String(getMonth(d) + 1).padStart(2, '0')}`)
    );
    const activeMonthsCount = Math.max(1, activeMonthKeys.size);
    const monthlyAvg = Number((total / activeMonthsCount).toFixed(1));

    const spanDays =
      parsedDates.length >= 2
        ? Math.max(1, differenceInCalendarDays(parsedDates[parsedDates.length - 1], parsedDates[0]) + 1)
        : 30;
    const dailyAvg = Number((total / spanDays).toFixed(2));
    // Média aproximada por dia útil (considerando ~22 dias úteis por mês ativo)
    const businessDaysAvg = Number((total / (activeMonthsCount * 22)).toFixed(2));

    // Evolução Mensal (usa sempre o histórico completo da unidade para o gráfico ficar rico mesmo quando 1 mês está filtrado)
    const unitAllHistory = allTrips.filter(
      (t) => (t.macro_unit || '').toUpperCase() === selectedUnit.toUpperCase()
    );
    const monthBuckets = SHORT_MONTHS.map((label, mIdx) => {
      const mTrips = unitAllHistory.filter((t) => {
        try {
          const d = parseISO(t.departure_datetime);
          return isValid(d) && getMonth(d) === mIdx;
        } catch {
          return false;
        }
      });
      return {
        label,
        total: mTrips.length,
        confirmed: mTrips.filter((t) => t.status === 'Confirmado ao Demandante').length,
        inDeadline: mTrips.filter((t) => t.status_deadline === 'Dentro do Prazo').length,
      };
    });
    const maxMonthTotal = Math.max(1, ...monthBuckets.map((m) => m.total));

    // Top 5 Destinos
    const destMap: Record<string, number> = {};
    unitTrips.forEach((t) => {
      const dName = getCityName(t.destination_city_id);
      destMap[dName] = (destMap[dName] || 0) + 1;
    });
    const topDestinations = Object.entries(destMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    // Top 5 Solicitantes
    const reqMap: Record<string, number> = {};
    unitTrips.forEach((t) => {
      const rName = (t.requester_name || 'Não informado').trim();
      reqMap[rName] = (reqMap[rName] || 0) + 1;
    });
    const topRequesters = Object.entries(reqMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    // Finalidades
    const actMap: Record<string, number> = {};
    unitTrips.forEach((t) => {
      const act = t.activity_type || 'Outros';
      actMap[act] = (actMap[act] || 0) + 1;
    });
    const activities = Object.entries(actMap).sort((a, b) => b[1] - a[1]);

    // Satisfação média (se houver avaliações)
    const rated = unitTrips.filter((t) => typeof t.rating_overall === 'number' && t.rating_overall > 0);
    const avgRating =
      rated.length > 0
        ? Number((rated.reduce((acc, t) => acc + Number(t.rating_overall || 0), 0) / rated.length).toFixed(1))
        : null;

    // Últimos 6 processos da unidade
    const recentTrips = [...unitTrips]
      .sort((a, b) => String(b.departure_datetime || '').localeCompare(String(a.departure_datetime || '')))
      .slice(0, 6);

    return {
      total,
      sharePct,
      confirmed,
      pending,
      rejected,
      cancelled,
      inDeadline,
      outDeadline,
      deadlineRate,
      attendanceRate,
      avgAdvanceDays,
      totalKm,
      totalPassengers,
      activeMonthsCount,
      monthlyAvg,
      dailyAvg,
      businessDaysAvg,
      monthBuckets,
      maxMonthTotal,
      topDestinations,
      topRequesters,
      activities,
      ratedCount: rated.length,
      avgRating,
      recentTrips,
    };
  }, [selectedUnit, baseDataset, allTrips, cities]);

  if (!selectedUnit || !stats) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop suave com fade */}
      <div
        onClick={handleAnimatedClose}
        className={`fixed inset-0 bg-navy-950/45 backdrop-blur-[2px] transition-opacity duration-300 ${
          isVisible ? 'opacity-100' : 'opacity-0'
        }`}
      />

      {/* Painel Deslizante Lateral (Slide-Over Drawer) */}
      <aside
        className={`relative z-10 w-full max-w-2xl bg-slate-50 h-full shadow-2xl border-l border-slate-200 flex flex-col transform transition-transform duration-300 ease-out ${
          isVisible ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Cabeçalho Fixo do Drawer */}
        <div className="bg-gradient-to-br from-navy-950 via-navy-900 to-brand-900 text-white p-5 sm:p-6 shrink-0 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-11 h-11 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center shrink-0">
                <Building2 className="w-5 h-5 text-brand-300" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-lg sm:text-xl font-black tracking-tight">{selectedUnit}</span>
                  <span className="px-2 py-0.5 rounded-full bg-brand-500/30 border border-brand-400/40 text-[10px] font-extrabold text-brand-100">
                    {stats.sharePct}% da UNILAB
                  </span>
                </div>
                <p className="text-xs text-slate-300 truncate mt-0.5">
                  {unitMeta?.name || `Raio-X Completo da Unidade Demandante ${selectedUnit}`}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleAnimatedClose}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors shrink-0"
              title="Fechar painel (ESC)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Alternador de Período + Troca Rápida entre Unidades */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-2 border-t border-white/10">
            <div className="inline-flex p-0.5 rounded-xl bg-black/25 border border-white/10 text-[11px] font-bold self-start">
              <button
                type="button"
                onClick={() => setScopeMode('period')}
                className={`px-3 py-1 rounded-lg transition-all ${
                  scopeMode === 'period' ? 'bg-white text-navy-950 shadow-xs' : 'text-slate-300 hover:text-white'
                }`}
              >
                {periodLabel}
              </button>
              <button
                type="button"
                onClick={() => setScopeMode('all')}
                className={`px-3 py-1 rounded-lg transition-all ${
                  scopeMode === 'all' ? 'bg-white text-navy-950 shadow-xs' : 'text-slate-300 hover:text-white'
                }`}
              >
                Histórico Completo
              </button>
            </div>

            <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
              {availableUnits.slice(0, 7).map((u) => (
                <button
                  key={u}
                  type="button"
                  onClick={() => onSelectUnit(u)}
                  className={`px-2.5 py-1 rounded-lg text-[10.5px] font-extrabold transition-all shrink-0 ${
                    u === selectedUnit
                      ? 'bg-brand-500 text-white shadow-xs'
                      : 'bg-white/10 text-slate-200 hover:bg-white/20'
                  }`}
                >
                  {u}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Corpo Rolável do Drawer */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
          {/* 6 KPI CARDS DA UNIDADE */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="bg-white rounded-2xl p-3.5 border border-slate-200/80 shadow-2xs space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                <TrendingUp className="w-3 h-3 text-brand-600" />
                Processos Enviados
              </span>
              <div className="text-2xl font-black text-navy-950">{stats.total}</div>
              <div className="text-[10.5px] text-slate-500">
                {stats.sharePct}% do total analisado
              </div>
            </div>

            <div className="bg-white rounded-2xl p-3.5 border border-slate-200/80 shadow-2xs space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                <Calendar className="w-3 h-3 text-indigo-600" />
                Média Mensal
              </span>
              <div className="text-2xl font-black text-navy-950">
                {stats.monthlyAvg.toLocaleString('pt-BR')}
                <span className="text-xs font-bold text-slate-400"> /mês</span>
              </div>
              <div className="text-[10.5px] text-slate-500">
                Em {stats.activeMonthsCount} {stats.activeMonthsCount === 1 ? 'mês ativo' : 'meses ativos'}
              </div>
            </div>

            <div className="bg-white rounded-2xl p-3.5 border border-slate-200/80 shadow-2xs space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                <Clock className="w-3 h-3 text-sky-600" />
                Média Diária
              </span>
              <div className="text-2xl font-black text-navy-950">
                {stats.businessDaysAvg.toLocaleString('pt-BR')}
                <span className="text-xs font-bold text-slate-400"> /dia útil</span>
              </div>
              <div className="text-[10.5px] text-slate-500">
                Antecedência média: <strong>{stats.avgAdvanceDays}d</strong>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-3.5 border border-slate-200/80 shadow-2xs space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                Dentro do Prazo
              </span>
              <div className="text-2xl font-black text-emerald-700">{stats.deadlineRate}%</div>
              <div className="text-[10.5px] text-slate-500">
                <strong className="text-emerald-700">{stats.inDeadline}</strong> no prazo •{' '}
                <strong className="text-rose-600">{stats.outDeadline}</strong> fora
              </div>
            </div>

            <div className="bg-white rounded-2xl p-3.5 border border-slate-200/80 shadow-2xs space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                <Activity className="w-3 h-3 text-emerald-600" />
                Taxa Atendimento
              </span>
              <div className="text-2xl font-black text-navy-950">{stats.attendanceRate}%</div>
              <div className="text-[10.5px] text-slate-500">
                {stats.confirmed} confirmadas • {stats.pending} pend.
              </div>
            </div>

            <div className="bg-white rounded-2xl p-3.5 border border-slate-200/80 shadow-2xs space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                <Milestone className="w-3 h-3 text-amber-600" />
                KM & Passageiros
              </span>
              <div className="text-xl font-black text-navy-950">
                {stats.totalKm.toLocaleString('pt-BR')} km
              </div>
              <div className="text-[10.5px] text-slate-500 flex items-center justify-between">
                <span>{stats.totalPassengers} pax</span>
                {stats.avgRating !== null && (
                  <span className="font-extrabold text-amber-600 flex items-center gap-0.5">
                    <Star className="w-3 h-3 fill-amber-400" />
                    {stats.avgRating}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* GRÁFICO 1: DISTRIBUIÇÃO DE STATUS (PADRÃO OFICIAL DE CORES) */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 space-y-3 shadow-2xs">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-600">
                Situação dos Processos da Unidade
              </h4>
              <span className="text-[11px] font-bold text-slate-500">{stats.total} no total</span>
            </div>

            <div className="w-full h-3.5 rounded-full bg-slate-100 overflow-hidden flex">
              {stats.confirmed > 0 && (
                <div
                  className="bg-emerald-500 h-full transition-all duration-500"
                  style={{ width: `${(stats.confirmed / (stats.total || 1)) * 100}%` }}
                  title={`Confirmado: ${stats.confirmed}`}
                />
              )}
              {stats.pending > 0 && (
                <div
                  className="bg-amber-400 h-full transition-all duration-500"
                  style={{ width: `${(stats.pending / (stats.total || 1)) * 100}%` }}
                  title={`Pendente: ${stats.pending}`}
                />
              )}
              {stats.rejected > 0 && (
                <div
                  className="bg-slate-900 h-full transition-all duration-500"
                  style={{ width: `${(stats.rejected / (stats.total || 1)) * 100}%` }}
                  title={`Indeferido: ${stats.rejected}`}
                />
              )}
              {stats.cancelled > 0 && (
                <div
                  className="bg-rose-500 h-full transition-all duration-500"
                  style={{ width: `${(stats.cancelled / (stats.total || 1)) * 100}%` }}
                  title={`Cancelado: ${stats.cancelled}`}
                />
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                <span className="text-slate-600">Confirmados:</span>
                <strong className="text-navy-950">{stats.confirmed}</strong>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shrink-0" />
                <span className="text-slate-600">Pendentes:</span>
                <strong className="text-navy-950">{stats.pending}</strong>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-900 shrink-0" />
                <span className="text-slate-600">Indeferidos:</span>
                <strong className="text-navy-950">{stats.rejected}</strong>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0" />
                <span className="text-slate-600">Cancelados:</span>
                <strong className="text-navy-950">{stats.cancelled}</strong>
              </div>
            </div>
          </div>

          {/* GRÁFICO 2: EVOLUÇÃO MENSAL DE SOLICITAÇÕES DA UNIDADE */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 space-y-3 shadow-2xs">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                <BarChart3 className="w-4 h-4 text-brand-600" />
                Evolução Mensal de Demandas ({selectedUnit})
              </h4>
              <span className="text-[10.5px] font-semibold text-slate-400">Histórico Jan–Dez</span>
            </div>

            <div className="h-36 flex items-end gap-1.5 sm:gap-2 pt-5 pb-1 px-1">
              {stats.monthBuckets.map((m) => {
                const heightPct = m.total > 0 ? Math.max(12, Math.round((m.total / stats.maxMonthTotal) * 100)) : 4;
                return (
                  <div
                    key={m.label}
                    className="flex-1 flex flex-col items-center justify-end h-full group"
                    title={`${m.label}: ${m.total} solicitações (${m.confirmed} confirmadas, ${m.inDeadline} no prazo)`}
                  >
                    <span
                      className={`text-[10px] font-extrabold mb-1 transition-colors ${
                        m.total > 0 ? 'text-navy-950' : 'text-slate-300'
                      }`}
                    >
                      {m.total > 0 ? m.total : ''}
                    </span>
                    <div
                      className={`w-full rounded-t-lg transition-all duration-500 ${
                        m.total > 0
                          ? 'bg-gradient-to-t from-brand-700 to-brand-500 group-hover:from-navy-900 group-hover:to-brand-600'
                          : 'bg-slate-100'
                      }`}
                      style={{ height: `${heightPct}%` }}
                    />
                    <span className="text-[10px] font-bold text-slate-500 mt-1.5">{m.label}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* TOP DESTINOS & TOP SOLICITANTES LADO A LADO */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="bg-white rounded-2xl border border-slate-200/80 p-4 space-y-2.5 shadow-2xs">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-brand-600" />
                Principais Destinos
              </h4>
              {stats.topDestinations.length === 0 ? (
                <div className="text-xs text-slate-400 py-2">Sem destinos no período</div>
              ) : (
                <div className="space-y-2">
                  {stats.topDestinations.map(([dest, count]) => {
                    const pct = Math.round((count / (stats.total || 1)) * 100);
                    return (
                      <div key={dest} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-slate-700 truncate">{dest}</span>
                          <span className="text-slate-500 font-semibold shrink-0 ml-2">
                            {count} ({pct}%)
                          </span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-brand-600 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="bg-white rounded-2xl border border-slate-200/80 p-4 space-y-2.5 shadow-2xs">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-navy-700" />
                Maiores Solicitantes
              </h4>
              {stats.topRequesters.length === 0 ? (
                <div className="text-xs text-slate-400 py-2">Sem solicitantes no período</div>
              ) : (
                <div className="space-y-2">
                  {stats.topRequesters.map(([reqName, count]) => {
                    const pct = Math.round((count / (stats.total || 1)) * 100);
                    return (
                      <div key={reqName} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-slate-700 truncate" title={reqName}>
                            {reqName}
                          </span>
                          <span className="text-slate-500 font-semibold shrink-0 ml-2">{count}</span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-navy-800 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* FINALIDADES DA UNIDADE */}
          {stats.activities.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200/80 p-4 space-y-2.5 shadow-2xs">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-indigo-600" />
                Finalidades das Viagens
              </h4>
              <div className="flex flex-wrap gap-2">
                {stats.activities.map(([act, count]) => (
                  <span
                    key={act}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700"
                  >
                    <span>{act}</span>
                    <span className="px-1.5 py-0.5 rounded-md bg-navy-950 text-white text-[10px]">
                      {count}
                    </span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* ÚLTIMOS PROCESSOS DA UNIDADE */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 space-y-3 shadow-2xs">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-600">
              Últimos Processos da Unidade ({stats.recentTrips.length})
            </h4>
            {stats.recentTrips.length === 0 ? (
              <div className="text-xs text-slate-400 text-center py-4">Nenhum processo encontrado.</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {stats.recentTrips.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => onSelectTripDetail(t)}
                    className="w-full py-2.5 px-2 -mx-2 rounded-xl hover:bg-slate-50 transition-colors flex items-center justify-between gap-2 text-left group"
                  >
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-extrabold text-xs text-navy-950">
                          {t.process_number}
                        </span>
                        <StatusBadge status={t.status} />
                        {t.status_deadline === 'Fora do Prazo' && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                            <AlertTriangle className="w-2.5 h-2.5" />
                            Fora do prazo
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 truncate">
                        {t.requester_name} • {getCityName(t.origin_city_id)} ➔ {getCityName(t.destination_city_id)} •{' '}
                        {safeFormatDate(t.departure_datetime, 'dd/MM/yyyy HH:mm', '-')}
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-brand-600 group-hover:translate-x-0.5 transition-all shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
};
