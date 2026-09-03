import React, { useState, useMemo } from 'react';
import { TripRequest, Vehicle, Driver, Contractor, City, FuelPrices, FuelType } from '../../types';
import { CostService } from '../../services/costService';
import { 
  BarChart3, 
  TrendingUp, 
  DollarSign, 
  Milestone, 
  Users, 
  Truck, 
  Calendar, 
  Building2, 
  Flame, 
  Award, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  FileSpreadsheet, 
  Download, 
  Filter,
  PieChart as PieChartIcon,
  Activity,
  Fuel,
  Wrench,
  Settings2,
  RotateCcw,
  Save,
  Gauge,
  Sparkles,
  Info,
  Sliders,
  Layers
} from 'lucide-react';
import { parseISO, getMonth, getYear, getDay, format, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { safeFormatDate } from '../../utils/dateUtils';

interface AnalyticsViewProps {
  trips: TripRequest[];
  vehicles: Vehicle[];
  drivers: Driver[];
  contractors: Contractor[];
  cities: City[];
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({
  trips,
  vehicles,
  drivers,
  contractors,
  cities,
}) => {
  // Aba ativa: 'bi' (Painel Completo) ou 'parameters' (Parametrização de Tarifas)
  const [activeTab, setActiveTab] = useState<'bi' | 'parameters'>('bi');

  const [selectedYear, setSelectedYear] = useState<string>('2026');
  const [selectedMonth, setSelectedMonth] = useState<string>('ALL'); // 'ALL' or '0'..'11'
  const [selectedMacro, setSelectedMacro] = useState<string>('ALL');

  // Parâmetros Financeiros Globais (Combustíveis e Manutenção por KM)
  const [fuelPrices, setFuelPrices] = useState<FuelPrices>(() => CostService.getFuelPrices());
  const [isSaved, setIsSaved] = useState(false);

  // Overrides locais por veículo (Permite editar Km/L e R$/km de manutenção diretamente na tabela)
  const [vehicleOverrides, setVehicleOverrides] = useState<Record<string, { avg_km_per_liter?: number; operational_cost_per_km?: number }>>({});

  // Modo do Heatmap: 'slots' (2 em 2h), 'hours' (06h-22h), 'shifts' (Turnos)
  const [heatmapMode, setHeatmapMode] = useState<'slots' | 'hours' | 'shifts'>('slots');

  // Célula selecionada/hover do Heatmap para detalhamento
  const [selectedCellTrips, setSelectedCellTrips] = useState<{ label: string; trips: TripRequest[] } | null>(null);

  // Helper para atualizar inputs de preços numéricos de forma robusta
  const handlePriceChange = (field: keyof FuelPrices, valueStr: string) => {
    const sanitized = valueStr.replace(',', '.');
    const num = parseFloat(sanitized);
    setFuelPrices((prev) => ({
      ...prev,
      [field]: isNaN(num) ? 0 : num,
    }));
  };

  const handleSaveParameters = () => {
    CostService.saveFuelPrices(fuelPrices);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2500);
  };

  const handleResetParameters = () => {
    const defaultPrices = CostService.resetFuelPrices();
    setFuelPrices(defaultPrices);
    setVehicleOverrides({});
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2500);
  };

  // Veículos combinados com seus overrides locais
  const effectiveVehicles = useMemo(() => {
    return vehicles.map((v) => {
      const override = vehicleOverrides[v.id];
      return {
        ...v,
        avg_km_per_liter: override?.avg_km_per_liter !== undefined ? override.avg_km_per_liter : v.avg_km_per_liter,
        operational_cost_per_km: override?.operational_cost_per_km !== undefined ? override.operational_cost_per_km : (v.operational_cost_per_km !== undefined ? v.operational_cost_per_km : fuelPrices.maintenancePerKm),
      };
    });
  }, [vehicles, vehicleOverrides, fuelPrices.maintenancePerKm]);

  // Filtragem dos dados de acordo com o escopo selecionado (Ano, Mês e Unidade)
  const scopedTrips = useMemo(() => {
    return trips.filter((t) => {
      try {
        const date = parseISO(t.departure_datetime);
        if (!isValid(date)) return false;
        const y = getYear(date).toString();
        const m = getMonth(date).toString();

        if (selectedYear !== 'ALL' && y !== selectedYear) return false;
        if (selectedMonth !== 'ALL' && m !== selectedMonth) return false;
        if (selectedMacro !== 'ALL' && t.macro_unit !== selectedMacro) return false;

        return true;
      } catch {
        return true;
      }
    });
  }, [trips, selectedYear, selectedMonth, selectedMacro]);

  // Cálculos de Custos Detalhados de Todas as Viagens no Escopo
  const tripsCostData = useMemo(() => {
    return scopedTrips.map((trip) => {
      const veh = effectiveVehicles.find((v) => v.id === trip.allocated_vehicle_id);
      const costBreakdown = CostService.calculateTripCost(trip, veh, fuelPrices);
      return {
        trip,
        veh,
        breakdown: costBreakdown,
      };
    });
  }, [scopedTrips, effectiveVehicles, fuelPrices]);

  // Cálculos de KPIs Globais Financeiros, Combustível e Manutenção
  const kpis = useMemo(() => {
    const total = scopedTrips.length;
    const confirmed = scopedTrips.filter((t) => t.status === 'Confirmado ao Demandante').length;
    const pending = scopedTrips.filter((t) => t.status === 'Pendente de Análise').length;
    const rejected = scopedTrips.filter((t) => t.status === 'Indeferido').length;
    
    const totalEstimatedKm = scopedTrips.reduce((acc, t) => acc + (Number(t.estimated_km) || 0), 0);
    const totalRealKm = scopedTrips.reduce((acc, t) => acc + (Number(t.real_km || t.estimated_km) || 0), 0);
    const totalPassengers = scopedTrips.reduce((acc, t) => acc + (Number(t.passenger_count) || 0), 0);

    let totalFuelLiters = 0;
    let totalGasolineLiters = 0;
    let totalDieselLiters = 0;
    let totalFuelCost = 0;
    let totalMaintenanceCost = 0;
    let totalCost = 0;

    tripsCostData.forEach(({ breakdown }) => {
      totalFuelLiters += breakdown.fuelLiters;
      if (breakdown.fuelType === 'Gasolina' || breakdown.fuelType === 'Flex') {
        totalGasolineLiters += breakdown.fuelLiters;
      } else {
        totalDieselLiters += breakdown.fuelLiters;
      }
      totalFuelCost += breakdown.fuelCost;
      totalMaintenanceCost += breakdown.operationalCost;
      totalCost += breakdown.totalCost;
    });

    const avgCostPerTrip = total > 0 ? totalCost / total : 0;
    const avgCostPerPax = totalPassengers > 0 ? totalCost / totalPassengers : 0;
    const avgFuelCostPerKm = totalRealKm > 0 ? totalFuelCost / totalRealKm : 0;
    const avgMaintenanceCostPerKm = totalRealKm > 0 ? totalMaintenanceCost / totalRealKm : fuelPrices.maintenancePerKm;
    const avgTotalCostPerKm = totalRealKm > 0 ? totalCost / totalRealKm : avgFuelCostPerKm + avgMaintenanceCostPerKm;
    const approvalRate = total > 0 ? Math.round((confirmed / total) * 100) : 0;

    return {
      total,
      confirmed,
      pending,
      rejected,
      totalEstimatedKm,
      totalRealKm,
      totalPassengers,
      totalFuelLiters,
      totalGasolineLiters,
      totalDieselLiters,
      totalFuelCost,
      totalMaintenanceCost,
      totalCost,
      avgCostPerTrip,
      avgCostPerPax,
      avgFuelCostPerKm,
      avgMaintenanceCostPerKm,
      avgTotalCostPerKm,
      approvalRate,
    };
  }, [scopedTrips, tripsCostData, fuelPrices.maintenancePerKm]);

  // Estatísticas de Custos por Veículo da Frota
  const vehicleStatsList = useMemo(() => {
    return effectiveVehicles.map((veh) => {
      return CostService.calculateVehicleStats(veh, scopedTrips, fuelPrices);
    }).sort((a, b) => b.totalKm - a.totalKm);
  }, [effectiveVehicles, scopedTrips, fuelPrices]);

  // Análise por Unidade Macro (Custos, Combustível e Manutenção)
  const macroStats = useMemo(() => {
    const map: Record<string, { count: number; km: number; fuelLiters: number; fuelCost: number; maintenanceCost: number; totalCost: number; pax: number }> = {};
    
    tripsCostData.forEach(({ trip, breakdown }) => {
      const u = trip.macro_unit || 'Outros';
      if (!map[u]) map[u] = { count: 0, km: 0, fuelLiters: 0, fuelCost: 0, maintenanceCost: 0, totalCost: 0, pax: 0 };
      map[u].count += 1;
      map[u].km += breakdown.km;
      map[u].fuelLiters += breakdown.fuelLiters;
      map[u].fuelCost += breakdown.fuelCost;
      map[u].maintenanceCost += breakdown.operationalCost;
      map[u].totalCost += breakdown.totalCost;
      map[u].pax += (Number(trip.passenger_count) || 0);
    });

    return Object.entries(map)
      .map(([unit, data]) => ({
        unit,
        ...data,
        costPercent: kpis.totalCost > 0 ? Math.round((data.totalCost / kpis.totalCost) * 100) : 0,
      }))
      .sort((a, b) => b.totalCost - a.totalCost);
  }, [tripsCostData, kpis.totalCost]);

  // Ranking de Solicitantes Mais Ativos (Top Requesters)
  const topRequesters = useMemo(() => {
    const map: Record<string, { name: string; unit: string; count: number; km: number; totalCost: number }> = {};
    tripsCostData.forEach(({ trip, breakdown }) => {
      const key = trip.requester_name.trim();
      if (!map[key]) {
        map[key] = { name: trip.requester_name, unit: trip.macro_unit, count: 0, km: 0, totalCost: 0 };
      }
      map[key].count += 1;
      map[key].km += breakdown.km;
      map[key].totalCost += breakdown.totalCost;
    });

    return Object.values(map)
      .sort((a, b) => b.count - a.count || b.km - a.km)
      .slice(0, 7);
  }, [tripsCostData]);

  // Ranking de Motoristas Mais Escalados
  const topDrivers = useMemo(() => {
    const map: Record<string, { driver: Driver; count: number; km: number; totalCost: number }> = {};
    tripsCostData.forEach(({ trip, breakdown }) => {
      if (!trip.allocated_driver_id) return;
      const d = drivers.find((item) => item.id === trip.allocated_driver_id);
      if (!d) return;

      if (!map[d.id]) {
        map[d.id] = { driver: d, count: 0, km: 0, totalCost: 0 };
      }
      map[d.id].count += 1;
      map[d.id].km += breakdown.km;
      map[d.id].totalCost += breakdown.totalCost;
    });

    return Object.values(map).sort((a, b) => b.count - a.count);
  }, [tripsCostData, drivers]);

  // --- MATRIZES DE HEATMAP ---
  const dayLabels = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

  // Modo 1: Faixas de Horários de 2h em 2h
  const timeSlotLabels = [
    '06h - 08h',
    '08h - 10h',
    '10h - 12h',
    '12h - 14h',
    '14h - 16h',
    '16h - 18h',
    '18h - 20h',
    '20h - 24h',
  ];

  const getTimeSlotIndex = (hour: number) => {
    if (hour < 6) return 7;
    if (hour >= 6 && hour < 8) return 0;
    if (hour >= 8 && hour < 10) return 1;
    if (hour >= 10 && hour < 12) return 2;
    if (hour >= 12 && hour < 14) return 3;
    if (hour >= 14 && hour < 16) return 4;
    if (hour >= 16 && hour < 18) return 5;
    if (hour >= 18 && hour < 20) return 6;
    return 7;
  };

  // Modo 2: Horas Individuais (06h às 22h)
  const individualHours = Array.from({ length: 17 }, (_, i) => i + 6); // 6..22

  // Modo 3: Turnos Operacionais
  const shiftLabels = ['Manhã (06h-12h)', 'Tarde (12h-18h)', 'Noite (18h-24h)', 'Madrugada (00h-06h)'];

  const getShiftIndex = (hour: number) => {
    if (hour >= 6 && hour < 12) return 0;
    if (hour >= 12 && hour < 18) return 1;
    if (hour >= 18 && hour <= 23) return 2;
    return 3;
  };

  // Heatmap Data Structures
  const { slotMatrix, slotTripsMatrix, hourMatrix, shiftMatrix, peakDay, peakHourSlot, hourlyDistribution } = useMemo(() => {
    const sMatrix: number[][] = Array(7).fill(0).map(() => Array(8).fill(0));
    const sTrips: TripRequest[][][] = Array(7).fill(null).map(() => Array(8).fill(null).map(() => []));
    const hMatrix: number[][] = Array(7).fill(0).map(() => Array(17).fill(0));
    const shMatrix: number[][] = Array(7).fill(0).map(() => Array(4).fill(0));
    const hDist: Record<number, number> = {};

    individualHours.forEach((h) => { hDist[h] = 0; });

    scopedTrips.forEach((t) => {
      try {
        const date = parseISO(t.departure_datetime);
        const day = getDay(date);
        const hour = date.getHours();

        // Slot Matrix (2h)
        const slotIdx = getTimeSlotIndex(hour);
        sMatrix[day][slotIdx] += 1;
        sTrips[day][slotIdx].push(t);

        // Individual Hours Matrix
        if (hour >= 6 && hour <= 22) {
          const hIdx = hour - 6;
          hMatrix[day][hIdx] += 1;
          hDist[hour] = (hDist[hour] || 0) + 1;
        }

        // Shift Matrix
        const shIdx = getShiftIndex(hour);
        shMatrix[day][shIdx] += 1;
      } catch {
        // ignore
      }
    });

    let maxDayCount = -1;
    let maxDayIdx = 0;
    sMatrix.forEach((slots, dIdx) => {
      const dayTotal = slots.reduce((a, b) => a + b, 0);
      if (dayTotal > maxDayCount) {
        maxDayCount = dayTotal;
        maxDayIdx = dIdx;
      }
    });

    let maxSlotCount = -1;
    let maxSlotIdx = 0;
    for (let slot = 0; slot < 8; slot++) {
      let slotTotal = 0;
      for (let day = 0; day < 7; day++) {
        slotTotal += sMatrix[day][slot];
      }
      if (slotTotal > maxSlotCount) {
        maxSlotCount = slotTotal;
        maxSlotIdx = slot;
      }
    }

    return {
      slotMatrix: sMatrix,
      slotTripsMatrix: sTrips,
      hourMatrix: hMatrix,
      shiftMatrix: shMatrix,
      peakDay: { name: dayLabels[maxDayIdx], count: maxDayCount },
      peakHourSlot: { label: timeSlotLabels[maxSlotIdx], count: maxSlotCount },
      hourlyDistribution: hDist,
    };
  }, [scopedTrips]);

  // Distribuição por Tipo de Atividade
  const activityDistribution = useMemo(() => {
    const map: Record<string, number> = {};
    scopedTrips.forEach((t) => {
      map[t.activity_type] = (map[t.activity_type] || 0) + 1;
    });
    return Object.entries(map).map(([name, count]) => ({
      name,
      count,
      pct: kpis.total > 0 ? Math.round((count / kpis.total) * 100) : 0,
    }));
  }, [scopedTrips, kpis.total]);

  const getHeatmapColor = (value: number) => {
    if (value === 0) return 'bg-slate-50 text-slate-400 border-slate-100 hover:bg-slate-100';
    if (value === 1) return 'bg-brand-50 text-brand-900 border-brand-200 font-bold hover:bg-brand-100 shadow-2xs';
    if (value === 2) return 'bg-brand-100 text-brand-950 border-brand-300 font-bold hover:bg-brand-200 shadow-xs';
    if (value === 3) return 'bg-amber-200 text-amber-950 border-amber-300 font-extrabold hover:bg-amber-300 shadow-xs';
    if (value === 4) return 'bg-orange-300 text-orange-950 border-orange-400 font-extrabold hover:bg-orange-400 shadow-sm';
    return 'bg-rose-500 text-white border-rose-600 font-black shadow-md animate-pulse';
  };

  const getContractorName = (id?: string) => {
    const c = contractors.find((item) => item.id === id);
    return c ? c.name.split(' ')[0] : 'Frota Própria';
  };

  const getCityName = (id: string) => {
    const c = cities.find((item) => item.id === id);
    return c ? c.name : id;
  };

  return (
    <div className="space-y-5">
      
      {/* Page Header: Título + Filtros de Ano e Mês diretamente ao lado para máxima praticidade */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        
        {/* Título do Painel */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-500/10 text-brand-600 flex items-center justify-center font-bold shadow-xs">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg sm:text-xl font-extrabold text-navy-950 tracking-tight">
                Painel de Análise & Inteligência (BI)
              </h2>
              <span className="text-[10.5px] font-bold bg-brand-50 text-brand-700 px-2 py-0.5 rounded-md border border-brand-200 hidden sm:inline">
                {scopedTrips.length} demandas
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Custos de combustível, manutenção por KM, centro de custos e heatmaps operacionais.
            </p>
          </div>
        </div>

        {/* Controles de Filtro: Ano, Mês, Unidade e Aba de Parametrização */}
        <div className="flex flex-wrap items-center gap-2">
          
          {/* Seletor de Ano */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 shadow-2xs">
            <Calendar className="w-3.5 h-3.5 text-brand-600" />
            <span className="text-[11px] font-bold text-slate-500">Ano:</span>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="bg-transparent text-xs font-bold text-navy-950 focus:outline-hidden cursor-pointer"
            >
              <option value="ALL">Todos</option>
              <option value="2026">2026</option>
              <option value="2025">2025</option>
            </select>
          </div>

          {/* Seletor de Mês */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 shadow-2xs">
            <Clock className="w-3.5 h-3.5 text-brand-600" />
            <span className="text-[11px] font-bold text-slate-500">Mês:</span>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-transparent text-xs font-bold text-navy-950 focus:outline-hidden cursor-pointer"
            >
              <option value="ALL">Ano Inteiro (Consolidado)</option>
              <option value="0">01 - Janeiro</option>
              <option value="1">02 - Fevereiro</option>
              <option value="2">03 - Março</option>
              <option value="3">04 - Abril</option>
              <option value="4">05 - Maio</option>
              <option value="5">06 - Junho</option>
              <option value="6">07 - Julho</option>
              <option value="7">08 - Agosto</option>
              <option value="8">09 - Setembro</option>
              <option value="9">10 - Outubro</option>
              <option value="10">11 - Novembro</option>
              <option value="11">12 - Dezembro</option>
            </select>
          </div>

          {/* Seletor de Unidade */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 shadow-2xs">
            <Building2 className="w-3.5 h-3.5 text-brand-600" />
            <span className="text-[11px] font-bold text-slate-500">Unidade:</span>
            <select
              value={selectedMacro}
              onChange={(e) => setSelectedMacro(e.target.value)}
              className="bg-transparent text-xs font-bold text-navy-950 focus:outline-hidden cursor-pointer max-w-[120px] truncate"
            >
              <option value="ALL">Todas</option>
              <option value="ICS">ICS</option>
              <option value="IDR">IDR</option>
              <option value="PROADI">PROADI</option>
              <option value="PROPAE">PROPAE</option>
              <option value="ICEN">ICEN</option>
              <option value="GR">GR</option>
              <option value="PROEX">PROEX</option>
              <option value="IH">IH</option>
              <option value="ICSA">ICSA</option>
            </select>
          </div>

          {/* Botão / Switcher para alternar entre o Painel BI e a Parametrização */}
          <div className="inline-flex p-0.5 bg-slate-100 rounded-xl border border-slate-200 ml-1">
            <button
              onClick={() => setActiveTab('bi')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'bi'
                  ? 'bg-white text-navy-950 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5 text-brand-600" />
              <span>Painel BI</span>
            </button>
            <button
              onClick={() => setActiveTab('parameters')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'parameters'
                  ? 'bg-navy-950 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Sliders className="w-3.5 h-3.5 text-amber-400" />
              <span>Parametrização</span>
            </button>
          </div>

        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODO 1: PAINEL DE ANÁLISE & BI COMPLETO                                   */}
      {/* ========================================================================= */}
      {activeTab === 'bi' && (
        <div className="space-y-6">
          
          {/* KPI Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* Custo Total de Combustível */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-card relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Combustível Total</span>
                <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                  <Fuel className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-2xl font-extrabold text-navy-950">
                  R$ {kpis.totalFuelCost.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="mt-2 text-[11px] text-slate-500 flex items-center gap-1.5">
                <span className="font-bold text-amber-700">{kpis.totalFuelLiters.toFixed(1)} L</span>
                <span>•</span>
                <span className="font-semibold">R$ {kpis.avgFuelCostPerKm.toFixed(2)}/km</span>
              </div>
            </div>

            {/* Gasto Total com Manutenção Veicular */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-card relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Manutenção Veicular Total</span>
                <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                  <Wrench className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-2xl font-extrabold text-navy-950">
                  R$ {kpis.totalMaintenanceCost.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="mt-2 text-[11px] text-slate-500 flex items-center gap-1.5">
                <span className="font-bold text-indigo-700">Média: R$ {kpis.avgMaintenanceCostPerKm.toFixed(2)}/km</span>
              </div>
            </div>

            {/* Custo Total Geral (Combustível + Manutenção) */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-card">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Custo Total de Transporte</span>
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                  <DollarSign className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-2xl font-extrabold text-navy-950">
                  R$ {kpis.totalCost.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="mt-2 text-[11px] text-slate-500">
                Custo total por KM: <strong>R$ {kpis.avgTotalCostPerKm.toFixed(2)}/km</strong>
              </div>
            </div>

            {/* KM Total Estimado / Real */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-card">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">KM Rodado no Período</span>
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                  <Milestone className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-2xl font-extrabold text-navy-950">
                  {kpis.totalRealKm.toLocaleString('pt-BR')}
                </span>
                <span className="text-xs text-slate-500 font-bold">KM</span>
              </div>
              <div className="mt-2 text-[11px] text-slate-500">
                {kpis.totalPassengers} passageiros atendidos
              </div>
            </div>

          </div>

          {/* TABELA DETALHADA: CUSTO DE COMBUSTÍVEL, MANUTENÇÃO POR KM E CONSUMO DE CADA VEÍCULO */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-5 sm:p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Gauge className="w-5 h-5 text-brand-600" />
                <div>
                  <h3 className="font-extrabold text-sm sm:text-base text-navy-950">
                    Detalhamento dos Veículos: Consumo (Km/L), Manutenção (R$/km) e Custos
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Você pode ajustar a autonomia (Km/L) e o valor de manutenção por KM diretamente nos campos editáveis da tabela.
                  </p>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100/90 text-slate-700 font-extrabold border-b border-slate-200 text-[10.5px] uppercase tracking-wider">
                    <th className="py-2.5 px-3 pl-4">Veículo / Placa</th>
                    <th className="py-2.5 px-2">Combustível</th>
                    <th className="py-2.5 px-2 text-center w-28">Consumo (Km/L)</th>
                    <th className="py-2.5 px-2 text-center w-28">Manutenção (R$/km)</th>
                    <th className="py-2.5 px-2 text-center">KM Rodado</th>
                    <th className="py-2.5 px-2 text-center">Litros Gastos</th>
                    <th className="py-2.5 px-2 text-right">Combustível (R$)</th>
                    <th className="py-2.5 px-2 text-right">Manutenção (R$)</th>
                    <th className="py-2.5 px-2 text-right">Custo Total / KM</th>
                    <th className="py-2.5 px-3 pr-4 text-right">Gasto Total Geral</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-[11px]">
                  {vehicleStatsList.map((stat) => {
                    const fuelBadge = stat.vehicle.fuel_type === 'Gasolina' || stat.vehicle.fuel_type === 'Flex'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-emerald-100 text-emerald-800';

                    return (
                      <tr key={stat.vehicle.id} className="hover:bg-slate-50/80 transition-colors">
                        
                        {/* Placa & Modelo */}
                        <td className="py-3 px-3 pl-4">
                          <div className="font-bold text-navy-950 font-mono">{stat.vehicle.plate}</div>
                          <div className="text-[10.5px] text-slate-600 font-medium truncate max-w-[140px]">{stat.vehicle.model}</div>
                        </td>

                        {/* Combustível */}
                        <td className="py-3 px-2">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${fuelBadge}`}>
                            {stat.vehicle.fuel_type}
                          </span>
                        </td>

                        {/* Consumo Km/L (Editável Inline) */}
                        <td className="py-3 px-2 text-center">
                          <div className="inline-flex items-center gap-1 bg-white border border-slate-300 rounded-lg px-2 py-1 shadow-2xs">
                            <input
                              type="number"
                              step="0.1"
                              min="1"
                              max="40"
                              value={stat.vehicle.avg_km_per_liter}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 1;
                                setVehicleOverrides((prev) => ({
                                  ...prev,
                                  [stat.vehicle.id]: {
                                    ...prev[stat.vehicle.id],
                                    avg_km_per_liter: val,
                                  },
                                }));
                              }}
                              className="w-12 text-center font-bold text-slate-800 focus:outline-hidden text-xs"
                            />
                            <span className="text-[10px] text-slate-400 font-semibold">km/L</span>
                          </div>
                        </td>

                        {/* Custo Manutenção por KM (Editável Inline) */}
                        <td className="py-3 px-2 text-center">
                          <div className="inline-flex items-center gap-1 bg-yellow-50/60 border border-yellow-300 rounded-lg px-2 py-1 shadow-2xs">
                            <span className="text-[10px] text-yellow-800 font-bold">R$</span>
                            <input
                              type="number"
                              step="0.05"
                              min="0"
                              max="10"
                              value={stat.vehicle.operational_cost_per_km}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 0;
                                setVehicleOverrides((prev) => ({
                                  ...prev,
                                  [stat.vehicle.id]: {
                                    ...prev[stat.vehicle.id],
                                    operational_cost_per_km: val,
                                  },
                                }));
                              }}
                              className="w-12 text-center font-bold text-slate-900 bg-transparent focus:outline-hidden text-xs"
                            />
                          </div>
                        </td>

                        {/* KM Rodado */}
                        <td className="py-3 px-2 text-center font-extrabold text-navy-950">
                          {stat.totalKm} km
                        </td>

                        {/* Litros Gastos */}
                        <td className="py-3 px-2 text-center font-bold text-amber-700 bg-amber-50/50">
                          {stat.totalFuelLiters.toFixed(1)} L
                        </td>

                        {/* Combustível (R$) */}
                        <td className="py-3 px-2 text-right font-bold text-slate-700">
                          R$ {stat.totalFuelCost.toFixed(2)}
                          <div className="text-[9.5px] text-slate-400">R$ {stat.fuelCostPerKm.toFixed(2)}/km</div>
                        </td>

                        {/* Manutenção (R$) */}
                        <td className="py-3 px-2 text-right font-bold text-yellow-800">
                          R$ {stat.totalOperationalCost.toFixed(2)}
                          <div className="text-[9.5px] text-yellow-600">R$ {stat.operationalCostPerKm.toFixed(2)}/km</div>
                        </td>

                        {/* Custo Total / KM */}
                        <td className="py-3 px-2 text-right font-extrabold text-brand-700">
                          R$ {stat.totalCostPerKm.toFixed(2)}/km
                        </td>

                        {/* Gasto Total Geral */}
                        <td className="py-3 px-3 pr-4 text-right font-black text-navy-950 text-xs">
                          R$ {stat.totalCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </td>

                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* HEATMAP ROBUSTO: DIA DA SEMANA × FAIXA HORÁRIA / HORAS */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-5 sm:p-6 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Flame className="w-5 h-5 text-rose-500" />
                <div>
                  <h3 className="font-extrabold text-sm sm:text-base text-navy-950">
                    Heatmap Gráfico de Viagens (Dia da Semana × Horário de Saída)
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Identifique horários de pico e gargalos de veículos e motoristas na escala da UNILAB.
                  </p>
                </div>
              </div>

              {/* Switcher de Visualização do Heatmap */}
              <div className="flex items-center gap-2">
                <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-1 border border-slate-200 text-xs">
                  <button
                    onClick={() => setHeatmapMode('slots')}
                    className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                      heatmapMode === 'slots' ? 'bg-white text-navy-950 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Faixas de 2h
                  </button>
                  <button
                    onClick={() => setHeatmapMode('hours')}
                    className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                      heatmapMode === 'hours' ? 'bg-white text-navy-950 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Horas (06h às 22h)
                  </button>
                  <button
                    onClick={() => setHeatmapMode('shifts')}
                    className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                      heatmapMode === 'shifts' ? 'bg-white text-navy-950 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Turnos
                  </button>
                </div>
              </div>
            </div>

            {/* Insight Highlights Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-gradient-to-r from-rose-50 via-amber-50 to-emerald-50 p-3.5 rounded-xl border border-rose-100 text-xs">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-rose-500/20 text-rose-700 flex items-center justify-center font-black">
                  🔥
                </div>
                <div>
                  <span className="text-slate-500 block text-[10.5px] font-bold uppercase">Dia de Maior Concentração</span>
                  <strong className="text-navy-950 text-xs sm:text-sm">{peakDay.name} ({peakDay.count} viagens no período)</strong>
                </div>
              </div>
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-700 flex items-center justify-center font-black">
                  ⏰
                </div>
                <div>
                  <span className="text-slate-500 block text-[10.5px] font-bold uppercase">Faixa Horária de Maior Pico</span>
                  <strong className="text-navy-950 text-xs sm:text-sm">{peakHourSlot.label} ({peakHourSlot.count} partidas no período)</strong>
                </div>
              </div>
            </div>

            {/* 1. MODO FAIXAS DE 2H (DEFAULT) */}
            {heatmapMode === 'slots' && (
              <div className="overflow-x-auto">
                <table className="w-full text-center border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                      <th className="py-2.5 px-3 text-left">Dia da Semana</th>
                      {timeSlotLabels.map((slot, idx) => (
                        <th key={idx} className="py-2.5 px-2">{slot}</th>
                      ))}
                      <th className="py-2.5 px-3 text-right pr-4 font-extrabold text-navy-950">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {dayLabels.map((dayName, dayIdx) => {
                      const dayTotal = slotMatrix[dayIdx].reduce((a, b) => a + b, 0);
                      return (
                        <tr key={dayIdx} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-2.5 px-3 text-left font-bold text-slate-800">
                            {dayName}
                          </td>
                          {slotMatrix[dayIdx].map((val, slotIdx) => {
                            const cellTrips = slotTripsMatrix[dayIdx][slotIdx];
                            return (
                              <td key={slotIdx} className="p-1.5">
                                <button
                                  onClick={() => {
                                    if (val > 0) {
                                      setSelectedCellTrips({
                                        label: `${dayName} às ${timeSlotLabels[slotIdx]}`,
                                        trips: cellTrips,
                                      });
                                    }
                                  }}
                                  className={`w-full py-2 px-1 rounded-xl border text-center transition-all ${getHeatmapColor(val)}`}
                                  title={val > 0 ? `${val} viagens. Clique para ver detalhes.` : 'Sem viagens'}
                                >
                                  <span className="block font-bold">{val}</span>
                                </button>
                              </td>
                            );
                          })}
                          <td className="py-2.5 px-3 pr-4 text-right font-extrabold text-navy-950 text-sm">
                            {dayTotal}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* 2. MODO HORAS CHEIAS (06H ÀS 22H) */}
            {heatmapMode === 'hours' && (
              <div className="overflow-x-auto">
                <table className="w-full text-center border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                      <th className="py-2.5 px-3 text-left min-w-[90px]">Dia</th>
                      {individualHours.map((h) => (
                        <th key={h} className="py-2.5 px-1.5 text-[11px] font-bold">{h}h</th>
                      ))}
                      <th className="py-2.5 px-2 text-right pr-3 font-extrabold text-navy-950">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {dayLabels.map((dayName, dayIdx) => {
                      const dayTotal = hourMatrix[dayIdx].reduce((a, b) => a + b, 0);
                      return (
                        <tr key={dayIdx} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-2 px-3 text-left font-bold text-slate-800">
                            {dayName}
                          </td>
                          {hourMatrix[dayIdx].map((val, hIdx) => (
                            <td key={hIdx} className="p-1">
                              <div className={`py-1.5 px-1 rounded-lg border text-center text-[11px] transition-all ${getHeatmapColor(val)}`}>
                                {val}
                              </div>
                            </td>
                          ))}
                          <td className="py-2 px-2 pr-3 text-right font-extrabold text-navy-950">
                            {dayTotal}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* 3. MODO TURNOS */}
            {heatmapMode === 'shifts' && (
              <div className="overflow-x-auto">
                <table className="w-full text-center border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                      <th className="py-3 px-4 text-left">Dia da Semana</th>
                      {shiftLabels.map((s, idx) => (
                        <th key={idx} className="py-3 px-3">{s}</th>
                      ))}
                      <th className="py-3 px-3 text-right pr-4 font-extrabold text-navy-950">Total Dia</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {dayLabels.map((dayName, dayIdx) => {
                      const dayTotal = shiftMatrix[dayIdx].reduce((a, b) => a + b, 0);
                      return (
                        <tr key={dayIdx} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-3 px-4 text-left font-bold text-slate-800">
                            {dayName}
                          </td>
                          {shiftMatrix[dayIdx].map((val, shiftIdx) => (
                            <td key={shiftIdx} className="p-2">
                              <div className={`py-2 px-3 rounded-xl border text-center transition-all ${getHeatmapColor(val)}`}>
                                {val} {val === 1 ? 'viagem' : 'viagens'}
                              </div>
                            </td>
                          ))}
                          <td className="py-3 px-3 pr-4 text-right font-extrabold text-navy-950 text-sm">
                            {dayTotal}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Gráfico de Barras: Distribuição Geral por Hora do Dia */}
            <div className="pt-4 border-t border-slate-100 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-extrabold text-slate-800">Partidas por Hora do Dia (06:00 às 22:00)</span>
                <span className="text-slate-500 font-medium">Concentração de Saídas</span>
              </div>
              <div 
                className="gap-1.5 h-20 items-end pt-2 w-full"
                style={{ display: 'grid', gridTemplateColumns: 'repeat(17, minmax(0, 1fr))' }}
              >
                {individualHours.map((h) => {
                  const count = hourlyDistribution[h] || 0;
                  const maxHourCount = Math.max(...Object.values(hourlyDistribution), 1);
                  const heightPct = Math.max((count / maxHourCount) * 100, 6);
                  return (
                    <div key={h} className="flex flex-col items-center gap-1 h-full justify-end group relative">
                      <div
                        className={`w-full rounded-t-md transition-all duration-500 ${
                          count > 0 ? 'bg-brand-500 hover:bg-brand-600' : 'bg-slate-100'
                        }`}
                        style={{ height: `${heightPct}%` }}
                      ></div>
                      <span className="text-[9px] font-bold text-slate-400 group-hover:text-navy-900">{h}h</span>
                      {count > 0 && (
                        <div className="absolute -top-7 opacity-0 group-hover:opacity-100 bg-navy-950 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow transition-opacity pointer-events-none whitespace-nowrap z-10">
                          {count} viagens
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* TWO COLUMNS: CUSTOS POR UNIDADE MACRO & TOP REQUISITANTES */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* 1. Custos e Consumo por Unidade Macro */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-5 sm:p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-brand-600" />
                  <h3 className="font-extrabold text-sm sm:text-base text-navy-950">
                    Centro de Custos por Unidade Macro
                  </h3>
                </div>
                <span className="text-[11px] font-bold text-slate-500">Participação Orçamentária</span>
              </div>

              <div className="space-y-3.5 pt-1">
                {macroStats.length === 0 ? (
                  <div className="text-center text-slate-400 py-8 text-xs">Sem viagens no período selecionado</div>
                ) : (
                  macroStats.map((item) => (
                    <div key={item.unit} className="space-y-1.5 p-2.5 rounded-xl hover:bg-slate-50/80 transition-colors border border-transparent hover:border-slate-100">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-extrabold text-slate-900">{item.unit}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-slate-500 font-medium">{item.count} viagens ({item.km} km)</span>
                          <span className="font-bold text-emerald-700">
                            R$ {item.totalCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-brand-500 h-2 rounded-full transition-all duration-500"
                          style={{ width: `${Math.max(item.costPercent, 4)}%` }}
                        ></div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* 2. Top Solicitantes Mais Ativos */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-5 sm:p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Award className="w-5 h-5 text-amber-500" />
                  <h3 className="font-extrabold text-sm sm:text-base text-navy-950">
                    Top Solicitantes Mais Ativos
                  </h3>
                </div>
                <span className="text-[11px] font-bold text-slate-500">Ranking por Demandas</span>
              </div>

              <div className="divide-y divide-slate-100">
                {topRequesters.length === 0 ? (
                  <div className="text-center text-slate-400 py-8 text-xs">Sem solicitantes no período</div>
                ) : (
                  topRequesters.map((req, idx) => {
                    const medalColors = ['bg-amber-400 text-white', 'bg-slate-300 text-slate-800', 'bg-amber-700 text-white'];
                    const medalBadge = idx < 3 ? medalColors[idx] : 'bg-slate-100 text-slate-600';

                    return (
                      <div key={idx} className="py-2.5 flex items-center justify-between gap-3 hover:bg-slate-50/80 px-2 rounded-xl transition-colors text-xs">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className={`w-6 h-6 rounded-full flex items-center justify-center font-extrabold text-[11px] shrink-0 ${medalBadge}`}>
                            {idx + 1}º
                          </span>
                          <div className="min-w-0">
                            <div className="font-bold text-slate-900 truncate" title={req.name}>{req.name}</div>
                            <div className="text-[10.5px] text-slate-500 font-medium">{req.unit}</div>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="font-extrabold text-navy-950 block">{req.count} viagens</span>
                          <span className="text-[10px] text-brand-700 font-bold">{req.km} km • R$ {req.totalCost.toFixed(0)}</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

          </div>

          {/* FINAL SECTION: PRODUTIVIDADE MOTORISTAS & FINALIDADE DE ATIVIDADE */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* 1. Produtividade dos Motoristas */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-5 sm:p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-emerald-600" />
                  <h3 className="font-extrabold text-sm sm:text-base text-navy-950">
                    Produtividade dos Motoristas
                  </h3>
                </div>
                <span className="text-[11px] font-bold text-slate-500">Escalas & Rotas Atendidas</span>
              </div>

              <div className="space-y-3">
                {topDrivers.length === 0 ? (
                  <div className="text-center text-slate-400 py-8 text-xs">Nenhum motorista escalado no período</div>
                ) : (
                  topDrivers.map((item) => (
                    <div key={item.driver.id} className="p-3 rounded-xl bg-slate-50/70 border border-slate-200/60 flex items-center justify-between gap-3 text-xs">
                      <div className="min-w-0 space-y-0.5">
                        <div className="font-bold text-slate-900">{item.driver.name}</div>
                        <div className="text-[11px] text-slate-500 font-medium">
                          CNH Cat. {item.driver.cnh_category} • {item.driver.driver_category} • {getContractorName(item.driver.contractor_id)}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-extrabold text-navy-950">{item.count} viagens</div>
                        <div className="text-[10.5px] text-emerald-700 font-bold">{item.km} km guiados</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* 2. Distribuição por Finalidade */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-5 sm:p-6 space-y-4">
              <div className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-indigo-600" />
                <h3 className="font-extrabold text-sm sm:text-base text-navy-950">
                  Distribuição por Finalidade Acadêmica
                </h3>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {activityDistribution.map((act) => (
                  <div key={act.name} className="p-4 rounded-xl bg-slate-50/80 border border-slate-200/70 space-y-1 text-center">
                    <span className="text-[11px] font-bold text-slate-500 block truncate" title={act.name}>{act.name}</span>
                    <div className="text-2xl font-extrabold text-navy-950">{act.count}</div>
                    <div className="text-xs font-bold text-brand-600">{act.pct}% das demandas</div>
                  </div>
                ))}
              </div>
            </div>

          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* MODO 2: PARAMETRIZAÇÃO & CUSTOS POR KM                                    */}
      {/* ========================================================================= */}
      {activeTab === 'parameters' && (
        <div className="space-y-6">
          
          {/* Card Principal de Parametrização dos Combustíveis e Manutenção */}
          <div className="bg-gradient-to-r from-navy-950 via-navy-900 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-amber-400">
                  <Fuel className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-extrabold text-base sm:text-lg text-white">
                      Parametrização: Preços dos Combustíveis & Manutenção Veicular por KM
                    </h3>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-brand-500/20 text-brand-300 border border-brand-400/30 flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      Recálculo em Tempo Real
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mt-1">
                    Altere os valores de referência para recalcular instantaneamente os gastos operacionais, consumo e custos de toda a frota.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  onClick={handleSaveParameters}
                  className="flex items-center gap-1.5 bg-brand-600 hover:bg-brand-500 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-md shadow-brand-600/30 transition-all active:scale-95"
                >
                  <Save className="w-4 h-4" />
                  <span>{isSaved ? 'Parâmetros Salvos!' : 'Salvar Parâmetros'}</span>
                </button>
                <button
                  onClick={handleResetParameters}
                  title="Restaurar parâmetros padrão da UNILAB"
                  className="p-2 text-slate-400 hover:text-white bg-white/10 hover:bg-white/20 rounded-xl transition-colors flex items-center gap-1.5 text-xs font-semibold"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span className="hidden sm:inline">Restaurar Padrão</span>
                </button>
              </div>
            </div>

            {/* Grid com os 4 Parâmetros Financeiros */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              
              {/* 1. Diesel S10 */}
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-brand-300 text-xs flex items-center gap-1.5">
                    <Fuel className="w-4 h-4" /> Diesel S10
                  </span>
                  <span className="text-[10px] text-slate-300 font-mono">Vans, Ônibus & Hilux</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-sm text-slate-300">R$</span>
                  <input
                    type="text"
                    value={fuelPrices.diesel}
                    onChange={(e) => handlePriceChange('diesel', e.target.value)}
                    className="w-full bg-black/30 border border-white/20 rounded-xl px-3 py-2 text-white font-extrabold text-base focus:border-brand-400 focus:outline-hidden"
                  />
                  <span className="text-xs text-slate-300 font-bold whitespace-nowrap">/ Litro</span>
                </div>
              </div>

              {/* 2. Gasolina Comum */}
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-amber-300 text-xs flex items-center gap-1.5">
                    <Fuel className="w-4 h-4" /> Gasolina Comum
                  </span>
                  <span className="text-[10px] text-slate-300 font-mono">Sedans Onix/Cronos</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-sm text-slate-300">R$</span>
                  <input
                    type="text"
                    value={fuelPrices.gasoline}
                    onChange={(e) => handlePriceChange('gasoline', e.target.value)}
                    className="w-full bg-black/30 border border-white/20 rounded-xl px-3 py-2 text-white font-extrabold text-base focus:border-amber-400 focus:outline-hidden"
                  />
                  <span className="text-xs text-slate-300 font-bold whitespace-nowrap">/ Litro</span>
                </div>
              </div>

              {/* 3. Etanol */}
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sky-300 text-xs flex items-center gap-1.5">
                    <Fuel className="w-4 h-4" /> Etanol Hidratado
                  </span>
                  <span className="text-[10px] text-slate-300 font-mono">Alternativa Flex</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-sm text-slate-300">R$</span>
                  <input
                    type="text"
                    value={fuelPrices.ethanol}
                    onChange={(e) => handlePriceChange('ethanol', e.target.value)}
                    className="w-full bg-black/30 border border-white/20 rounded-xl px-3 py-2 text-white font-extrabold text-base focus:border-sky-400 focus:outline-hidden"
                  />
                  <span className="text-xs text-slate-300 font-bold whitespace-nowrap">/ Litro</span>
                </div>
              </div>

              {/* 4. GASTO POR KM COM MANUTENÇÃO VEICULAR */}
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border-2 border-brand-400/50 space-y-2.5 shadow-lg">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-yellow-300 text-xs flex items-center gap-1.5">
                    <Wrench className="w-4 h-4" /> Manutenção por KM
                  </span>
                  <span className="text-[10px] text-yellow-200/80 font-mono">Pneus, Peças & Óleo</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-sm text-slate-300">R$</span>
                  <input
                    type="text"
                    value={fuelPrices.maintenancePerKm}
                    onChange={(e) => handlePriceChange('maintenancePerKm', e.target.value)}
                    className="w-full bg-black/40 border border-yellow-400/50 rounded-xl px-3 py-2 text-yellow-200 font-extrabold text-base focus:border-yellow-300 focus:outline-hidden"
                  />
                  <span className="text-xs text-slate-300 font-bold whitespace-nowrap">/ KM</span>
                </div>
              </div>

            </div>
          </div>

          {/* Card com Metodologia de Cálculo de Custos */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-6 space-y-3 text-xs">
            <div className="flex items-center gap-2 font-bold text-navy-950 text-sm">
              <Info className="w-4 h-4 text-brand-600" />
              <span>Como os Custos e Indicadores são Processados?</span>
            </div>
            <p className="text-slate-600 leading-relaxed">
              O sistema calcula o custo de cada viagem institucional multiplicando a distância de ida e volta (KM) pela eficiência média do veículo selecionado (Km/L) e somando o custo estimado de desgaste operacional e manutenção preventiva por quilômetro rodado.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <strong className="block text-slate-900 font-bold">1. Consumo de Combustível</strong>
                <p className="text-slate-500 text-[11px]"><code>Litros = KM Total ÷ Consumo Médio (Km/L)</code></p>
                <p className="text-slate-500 text-[11px]"><code>Custo Combustível = Litros × Preço do Litro</code></p>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <strong className="block text-slate-900 font-bold">2. Manutenção & Desgaste</strong>
                <p className="text-slate-500 text-[11px]"><code>Custo Manutenção = KM Total × R$/km Operacional</code></p>
                <p className="text-slate-500 text-[11px]">Engloba pneus, óleo, peças e seguro proporcional.</p>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <strong className="block text-slate-900 font-bold">3. Custo Total da Demanda</strong>
                <p className="text-slate-500 text-[11px]"><code>Custo Total = Custo Combustível + Custo Manutenção</code></p>
                <p className="text-slate-500 text-[11px]">Consolidado em tempo real em todos os painéis e relatórios.</p>
              </div>
            </div>
          </div>

        </div>
      )}

      {/* MODAL DETALHE DE VIAGENS DA CÉLULA DO HEATMAP */}
      {selectedCellTrips && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200/80 w-full max-w-xl overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <span className="text-[10px] font-bold text-brand-600 uppercase tracking-wider">Viagens Agendadas</span>
                <h3 className="font-extrabold text-base text-navy-950">{selectedCellTrips.label}</h3>
              </div>
              <button
                onClick={() => setSelectedCellTrips(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto space-y-3">
              {selectedCellTrips.trips.map((t) => (
                <div key={t.id} className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-navy-950">{t.process_number}</span>
                    <span className="font-semibold text-emerald-700">{t.estimated_km} km</span>
                  </div>
                  <div className="text-slate-600">
                    <strong>Solicitante:</strong> {t.requester_name} ({t.macro_unit})
                  </div>
                  <div className="text-slate-600">
                    <strong>Itinerário:</strong> {getCityName(t.origin_city_id)} ➔ {getCityName(t.destination_city_id)}
                  </div>
                  <div className="text-slate-500 text-[11px]">
                    Saída: {safeFormatDate(t.departure_datetime, "dd/MM 'às' HH:mm", '-')} • {t.passenger_count} passageiros
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default AnalyticsView;
