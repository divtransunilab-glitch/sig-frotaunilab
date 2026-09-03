import React, { useState, useMemo } from 'react';
import { TripRequest } from '../../types';
import { TripService } from '../../services/tripService';
import { DistanceService } from '../../services/distanceService';
import { FleetService } from '../../services/fleetService';
import { StatusBadge } from '../common/StatusBadge';
import { 
  SendHorizontal, 
  CheckCircle2, 
  Clock, 
  XCircle, 
  Milestone, 
  AlertTriangle, 
  TrendingUp, 
  Building2, 
  Users, 
  ArrowRight, 
  PlusCircle, 
  Truck, 
  Sparkles,
  Ban,
  Calendar,
  Layers,
  Check,
  Fuel,
  Filter
} from 'lucide-react';
import { format, parseISO, getMonth, getYear, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { safeFormatDate } from '../../utils/dateUtils';

interface DashboardOverviewProps {
  trips: TripRequest[];
  onOpenNewTripModal: () => void;
  onOpenDispatchModal: (trip: TripRequest) => void;
  onSelectTripDetail: (trip: TripRequest) => void;
  onNavigateTab: (tab: string) => void;
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({
  trips,
  onOpenNewTripModal,
  onOpenDispatchModal,
  onSelectTripDetail,
  onNavigateTab,
}) => {
  const currentDate = new Date();
  const currentMonthIdx = currentDate.getMonth(); // 0-11
  const currentYearNum = currentDate.getFullYear();

  // Ao iniciar o sistema, sempre abre no mês vigente!
  const [selectedYear, setSelectedYear] = useState<string>(currentYearNum.toString());
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthIdx.toString());

  // Lista dos 12 meses do ano + Opção Consolidada
  const monthsList = [
    { id: 'ALL', label: 'Ano Inteiro (Consolidado)' },
    { id: '0', label: '01 - Jan' },
    { id: '1', label: '02 - Fev' },
    { id: '2', label: '03 - Mar' },
    { id: '3', label: '04 - Abr' },
    { id: '4', label: '05 - Mai' },
    { id: '5', label: '06 - Jun' },
    { id: '6', label: '07 - Jul' },
    { id: '7', label: '08 - Ago' },
    { id: '8', label: '09 - Set' },
    { id: '9', label: '10 - Out' },
    { id: '10', label: '11 - Nov' },
    { id: '11', label: '12 - Dez' },
  ];

  // Contagem dinâmica de demandas por mês para o ano selecionado
  const countByMonth = useMemo(() => {
    const map: Record<string, number> = { ALL: 0 };
    trips.forEach((t) => {
      try {
        const d = parseISO(t.departure_datetime);
        if (isValid(d)) {
          const y = getYear(d).toString();
          const m = getMonth(d).toString();
          if (selectedYear === 'ALL' || y === selectedYear) {
            map.ALL = (map.ALL || 0) + 1;
            map[m] = (map[m] || 0) + 1;
          }
        }
      } catch {
        // ignore
      }
    });
    return map;
  }, [trips, selectedYear]);

  // Filtragem das viagens pelo escopo selecionado (Ano e Mês)
  const scopedTrips = useMemo(() => {
    return trips.filter((t) => {
      try {
        const d = parseISO(t.departure_datetime);
        if (!isValid(d)) return true;
        const y = getYear(d).toString();
        const m = getMonth(d).toString();

        if (selectedYear !== 'ALL' && y !== selectedYear) return false;
        if (selectedMonth !== 'ALL' && m !== selectedMonth) return false;

        return true;
      } catch {
        return true;
      }
    });
  }, [trips, selectedYear, selectedMonth]);

  // Métricas Consolidadas do Período
  const metrics = useMemo(() => {
    const totalRequests = scopedTrips.length;
    const confirmed = scopedTrips.filter((t) => t.status === 'Confirmado ao Demandante').length;
    const pending = scopedTrips.filter((t) => t.status === 'Pendente de Análise').length;
    const rejected = scopedTrips.filter((t) => t.status === 'Indeferido').length;
    
    const cancelledByDemandante = scopedTrips.filter((t) => t.status === 'Cancelado pelo Demandante').length;
    const cancelledByExecutante = scopedTrips.filter((t) => t.status === 'Cancelado pela Unidade Executante').length;
    const cancelled = cancelledByDemandante + cancelledByExecutante;

    // Indeferimentos específicos
    const rejectedUnavailability = scopedTrips.filter(
      (t) =>
        t.status === 'Indeferido' &&
        (t.rejection_reason === 'Indisponibilidade de veículo' ||
          t.rejection_reason === 'Indisponibilidade de veículo e KM')
    ).length;
    const rejectedOther = rejected - rejectedUnavailability;

    // Prazos
    const outOfDeadline = scopedTrips.filter((t) => t.status_deadline === 'Fora do Prazo').length;
    const inDeadline = scopedTrips.filter((t) => t.status_deadline === 'Dentro do Prazo').length;
    const pendingOutOfDeadline = scopedTrips.filter(
      (t) => t.status === 'Pendente de Análise' && t.status_deadline === 'Fora do Prazo'
    ).length;

    // Taxas percentuais
    const rejectionRate = totalRequests > 0 ? ((rejected / totalRequests) * 100).toFixed(1) : '0.0';
    const cancellationRate = totalRequests > 0 ? ((cancelled / totalRequests) * 100).toFixed(1) : '0.0';
    const confirmationRate = totalRequests > 0 ? ((confirmed / totalRequests) * 100).toFixed(1) : '0.0';
    const pendingRate = totalRequests > 0 ? ((pending / totalRequests) * 100).toFixed(1) : '0.0';
    const unavailabilityRate = totalRequests > 0 ? ((rejectedUnavailability / totalRequests) * 100).toFixed(1) : '0.0';

    // Quilometragem e Passageiros
    const totalKmEstimated = scopedTrips.reduce((acc, t) => acc + (Number(t.estimated_km) || 0), 0);
    const totalKmReal = scopedTrips.reduce((acc, t) => acc + (Number(t.real_km || t.estimated_km) || 0), 0);
    const totalPassengers = scopedTrips.reduce((acc, t) => acc + (Number(t.passenger_count) || 0), 0);

    // Por Unidade Macro
    const byMacroUnit: Record<string, number> = {};
    scopedTrips.forEach((t) => {
      const u = t.macro_unit || 'Outros';
      byMacroUnit[u] = (byMacroUnit[u] || 0) + 1;
    });

    // Por Tipo de Atividade
    const byActivity: Record<string, number> = {};
    scopedTrips.forEach((t) => {
      byActivity[t.activity_type] = (byActivity[t.activity_type] || 0) + 1;
    });

    return {
      totalRequests,
      confirmed,
      pending,
      rejected,
      cancelled,
      cancelledByDemandante,
      cancelledByExecutante,
      rejectedUnavailability,
      rejectedOther,
      outOfDeadline,
      inDeadline,
      pendingOutOfDeadline,
      rejectionRate,
      cancellationRate,
      confirmationRate,
      pendingRate,
      unavailabilityRate,
      totalKmEstimated,
      totalKmReal,
      totalPassengers,
      byMacroUnit,
      byActivity,
    };
  }, [scopedTrips]);

  // Fila de Escala e Viagens Confirmadas filtradas pelo escopo do mês selecionado/vigente
  const pendingTrips = useMemo(() => {
    return scopedTrips
      .filter((t) => t.status === 'Pendente de Análise')
      .sort((a, b) => new Date(a.departure_datetime).getTime() - new Date(b.departure_datetime).getTime());
  }, [scopedTrips]);

  const recentConfirmed = useMemo(() => {
    return scopedTrips
      .filter((t) => t.status === 'Confirmado ao Demandante')
      .sort((a, b) => new Date(b.departure_datetime).getTime() - new Date(a.departure_datetime).getTime())
      .slice(0, 6);
  }, [scopedTrips]);

  const cities = DistanceService.getCities();
  const contractors = FleetService.getContractors();

  const getCityName = (id: string) => {
    const c = cities.find((item) => item.id === id);
    return c ? c.name : id;
  };

  const getContractorName = (id?: string) => {
    if (!id) return 'Não alocada';
    const c = contractors.find((item) => item.id === id);
    return c ? c.name : id;
  };

  const getMonthLabel = (id: string) => {
    const found = monthsList.find((m) => m.id === id);
    return found ? found.label : id;
  };

  return (
    <div className="space-y-5">
      
      {/* Top Banner / Welcome Action */}
      <div className="rounded-3xl hero-wine-gradient p-6 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-full bg-radial from-brand-500/20 to-transparent pointer-events-none"></div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-brand-500/20 border border-brand-400/30 text-brand-300 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5" />
              Painel Operacional do Gestor de Frotas
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight text-white">
              Sistema de Controle de Viagens & Transportes
            </h1>
            <p className="text-slate-300 text-xs sm:text-sm max-w-2xl">
              Acompanhamento consolidado das demandas institucionais, despacho de frotas e cálculo de quilometragem da UNILAB.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onOpenNewTripModal}
              className="flex items-center gap-2 bg-brand-500 hover:bg-brand-600 text-white px-4 py-2.5 rounded-xl text-xs font-bold shadow-lg shadow-brand-500/30 transition-all active:scale-95 whitespace-nowrap"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Cadastro de Solicitação</span>
            </button>
            <button
              onClick={() => onNavigateTab('dispatch')}
              className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white border border-white/20 px-4 py-2.5 rounded-xl text-xs font-bold backdrop-blur-md transition-all whitespace-nowrap"
            >
              <SendHorizontal className="w-4 h-4 text-brand-300" />
              <span>Fila & Escala de Demandas</span>
            </button>
          </div>
        </div>
      </div>

      {/* SELETOR DE MÊS E ANO EM LISTA DROPDOWN (Inicia automaticamente no Mês Vigente) */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-brand-600" />
          <span className="text-xs font-extrabold text-navy-950">Visualização de Indicadores:</span>
          <span className="text-[11px] font-bold text-brand-700 bg-brand-50 px-2 py-0.5 rounded-md border border-brand-200">
            {scopedTrips.length} solicitações analisadas
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Seletor de Ano (Lista Dropdown) */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs shadow-2xs">
            <span className="font-bold text-slate-500 text-[11px]">Ano:</span>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="bg-transparent font-extrabold text-navy-950 focus:outline-hidden cursor-pointer text-xs"
            >
              <option value="2026">2026</option>
              <option value="2025">2025</option>
              <option value="ALL">Todos os Anos</option>
            </select>
          </div>

          {/* Seletor de Mês (Lista Dropdown) */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs shadow-2xs">
            <Clock className="w-3.5 h-3.5 text-brand-600" />
            <span className="font-bold text-slate-500 text-[11px]">Mês:</span>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-transparent font-extrabold text-navy-950 focus:outline-hidden cursor-pointer text-xs"
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
              <option value="8">09 - Setembro (Vigente)</option>
              <option value="9">10 - Outubro</option>
              <option value="10">11 - Novembro</option>
              <option value="11">12 - Dezembro</option>
            </select>
          </div>

          {/* Atalho para Mês Vigente Atual */}
          {selectedMonth !== currentMonthIdx.toString() && (
            <button
              onClick={() => {
                setSelectedYear(currentYearNum.toString());
                setSelectedMonth(currentMonthIdx.toString());
              }}
              className="px-3 py-1.5 bg-brand-50 hover:bg-brand-100 text-brand-700 rounded-xl text-xs font-bold border border-brand-200 transition-colors flex items-center gap-1"
            >
              <span>Voltar ao Mês Vigente</span>
            </button>
          )}
        </div>
      </div>

      {/* 5 KPI CARDS GRID COM DADOS GERAIS COMPLETOS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        
        {/* 1. Total de Solicitações Recebidas */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-card hover:shadow-card-hover transition-all space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Solicitações Recebidas</span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-3xl font-black text-navy-950">{metrics.totalRequests}</span>
            <span className="text-xs text-slate-500 font-semibold">demandas</span>
          </div>
          <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-100 flex items-center justify-between">
            <span className="text-emerald-700 font-bold">{metrics.confirmed} confirmadas ({metrics.confirmationRate}%)</span>
            <span className="text-slate-400 font-medium">{metrics.inDeadline} no prazo</span>
          </div>
        </div>

        {/* 2. Aguardando Escala (Pendentes) */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-card hover:shadow-card-hover transition-all space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Aguardando Escala</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-amber-600">{metrics.pending}</span>
            {metrics.pendingOutOfDeadline > 0 && (
              <span className="bg-rose-100 text-rose-700 text-[10px] font-extrabold px-2 py-0.5 rounded-full border border-rose-200 animate-pulse">
                {metrics.pendingOutOfDeadline} fora do prazo
              </span>
            )}
          </div>
          <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-100">
            {metrics.pendingRate}% da fila geral pendente
          </div>
        </div>

        {/* 3. Taxa de Indeferimento & Total Indeferido */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-card hover:shadow-card-hover transition-all space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Taxa de Indeferimento</span>
            <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
              <XCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-rose-600">{metrics.rejectionRate}%</span>
            <span className="text-xs text-rose-700 font-bold bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
              {metrics.rejected} indeferidas
            </span>
          </div>
          <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-100">
            Por falta de veículo/KM: <strong>{metrics.unavailabilityRate}%</strong>
          </div>
        </div>

        {/* 4. Total de Cancelamentos */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-card hover:shadow-card-hover transition-all space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Canceladas no Período</span>
            <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center font-bold">
              <Ban className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-700">{metrics.cancelled}</span>
            <span className="text-xs text-slate-500 font-bold">({metrics.cancellationRate}%)</span>
          </div>
          <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-100 flex items-center justify-between">
            <span>Demandante: <strong>{metrics.cancelledByDemandante}</strong></span>
            <span>•</span>
            <span>DIVTRANS: <strong>{metrics.cancelledByExecutante}</strong></span>
          </div>
        </div>

        {/* 5. KM Total Previsto & Real */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-card hover:shadow-card-hover transition-all space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Quilometragem Total</span>
            <div className="w-8 h-8 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center font-bold">
              <Milestone className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl sm:text-3xl font-black text-navy-950">{metrics.totalKmEstimated.toLocaleString('pt-BR')}</span>
            <span className="text-xs text-slate-500 font-bold">km</span>
          </div>
          <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-100 truncate">
            {metrics.totalPassengers.toLocaleString('pt-BR')} passageiros atendidos
          </div>
        </div>

      </div>

      {/* BARRA DE STATUS MULTICOLORIDA CONSOLIDADA */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-4 space-y-2.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-2">
          <span className="font-extrabold text-navy-950">Distribuição de Status das Solicitações ({scopedTrips.length} demandas)</span>
          <div className="flex flex-wrap items-center gap-3 text-[11px] font-bold">
            <span className="flex items-center gap-1.5 text-emerald-700">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 inline-block"></span>
              Confirmadas: {metrics.confirmed} ({metrics.confirmationRate}%)
            </span>
            <span className="flex items-center gap-1.5 text-amber-700">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block"></span>
              Pendentes: {metrics.pending} ({metrics.pendingRate}%)
            </span>
            <span className="flex items-center gap-1.5 text-rose-700">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block"></span>
              Indeferidas: {metrics.rejected} ({metrics.rejectionRate}%)
            </span>
            <span className="flex items-center gap-1.5 text-slate-600">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-400 inline-block"></span>
              Canceladas: {metrics.cancelled} ({metrics.cancellationRate}%)
            </span>
          </div>
        </div>

        <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden flex shadow-inner">
          <div
            title={`Confirmadas: ${metrics.confirmed} (${metrics.confirmationRate}%)`}
            className="bg-emerald-500 hover:bg-emerald-600 transition-all duration-500"
            style={{ width: `${metrics.confirmationRate}%` }}
          ></div>
          <div
            title={`Pendentes: ${metrics.pending} (${metrics.pendingRate}%)`}
            className="bg-amber-400 hover:bg-amber-500 transition-all duration-500"
            style={{ width: `${metrics.pendingRate}%` }}
          ></div>
          <div
            title={`Indeferidas: ${metrics.rejected} (${metrics.rejectionRate}%)`}
            className="bg-rose-500 hover:bg-rose-600 transition-all duration-500"
            style={{ width: `${metrics.rejectionRate}%` }}
          ></div>
          <div
            title={`Canceladas: ${metrics.cancelled} (${metrics.cancellationRate}%)`}
            className="bg-slate-400 hover:bg-slate-500 transition-all duration-500"
            style={{ width: `${metrics.cancellationRate}%` }}
          ></div>
        </div>
      </div>

      {/* Main Grid: Pending Action Center + Analytics Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Urgent Action Center / Fila de Escala Imediata (2 Columns) */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 shadow-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping"></div>
              <h2 className="font-bold text-base text-slate-900">
                Fila de Escala Imediata ({pendingTrips.length})
              </h2>
            </div>
            <button
              onClick={() => onNavigateTab('dispatch')}
              className="text-xs font-bold text-brand-700 hover:text-brand-800 flex items-center gap-1 group"
            >
              <span>Ver todas na fila</span>
              <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
            </button>
          </div>

          {pendingTrips.length === 0 ? (
            <div className="py-10 text-center text-slate-400 text-xs">
              <CheckCircle2 className="w-8 h-8 text-brand-600 mx-auto mb-2 opacity-80" />
              Nenhuma solicitação pendente no período selecionado! Todas as demandas foram escaladas.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {pendingTrips.slice(0, 5).map((trip) => {
                const departureFormatted = safeFormatDate(trip.departure_datetime, "dd/MM 'às' HH:mm", '-');
                return (
                  <div key={trip.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/80 p-2 rounded-xl transition-colors">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-xs text-navy-900">{trip.process_number}</span>
                        <span className="bg-slate-100 text-slate-700 text-[10px] font-bold px-2 py-0.5 rounded">
                          {trip.macro_unit}
                        </span>
                        <StatusBadge deadline={trip.status_deadline} />
                      </div>
                      <div className="text-xs text-slate-700">
                        <strong>{trip.requester_name}</strong> • {getCityName(trip.origin_city_id)} ➔ {getCityName(trip.destination_city_id)} ({trip.estimated_km} km)
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Saída: <strong>{departureFormatted}</strong> • {trip.passenger_count} passageiros • {trip.activity_type}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center">
                      <button
                        onClick={() => onSelectTripDetail(trip)}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-200/70 transition-colors"
                      >
                        Detalhes
                      </button>
                      <button
                        onClick={() => onOpenDispatchModal(trip)}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold bg-brand-600 hover:bg-brand-700 text-white shadow-xs transition-all flex items-center gap-1.5 whitespace-nowrap active:scale-95"
                      >
                        <SendHorizontal className="w-3.5 h-3.5" />
                        <span>Escalar Demanda</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Distribution / Macro Units & Activity (1 Column) */}
        <div className="space-y-6">
          
          {/* Por Unidade Macro */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-5 space-y-3">
            <h3 className="font-bold text-xs uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-brand-600" />
              Demandas por Unidade Macro
            </h3>
            <div className="space-y-2 pt-1">
              {Object.entries(metrics.byMacroUnit).length === 0 ? (
                <div className="text-xs text-slate-400 py-3 text-center">Sem dados no período</div>
              ) : (
                Object.entries(metrics.byMacroUnit).map(([unit, count]) => {
                  const pct = Math.round((count / (metrics.totalRequests || 1)) * 100);
                  return (
                    <div key={unit} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-700">{unit}</span>
                        <span className="text-slate-500">{count} ({pct}%)</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-brand-500 h-1.5 rounded-full transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Por Tipo de Atividade */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-5 space-y-3">
            <h3 className="font-bold text-xs uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Users className="w-4 h-4 text-navy-600" />
              Finalidade da Demanda
            </h3>
            <div className="space-y-2 pt-1">
              {Object.entries(metrics.byActivity).map(([act, count]) => {
                const pct = Math.round((count / (metrics.totalRequests || 1)) * 100);
                return (
                  <div key={act} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-700">{act}</span>
                      <span className="text-slate-500 font-semibold">{count}</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-navy-700 h-1.5 rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>

      </div>

      {/* Confirmed Trips Section / Recent Activity */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <h3 className="font-bold text-sm text-slate-900">
              Viagens Confirmadas Recentes
            </h3>
          </div>
          <button
            onClick={() => onNavigateTab('calendar')}
            className="text-xs font-bold text-brand-700 hover:text-brand-800 flex items-center gap-1 group"
          >
            <span>Ver Agenda Completa</span>
            <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {recentConfirmed.map((trip) => {
            const departureFormatted = safeFormatDate(trip.departure_datetime, "dd/MM 'às' HH:mm", '-');
            const vehicle = FleetService.getVehicleById(trip.allocated_vehicle_id);
            const driver = FleetService.getDriverById(trip.allocated_driver_id);

            return (
              <div
                key={trip.id}
                onClick={() => onSelectTripDetail(trip)}
                className="p-3.5 rounded-xl bg-slate-50/80 hover:bg-slate-100/90 border border-slate-200/60 cursor-pointer transition-all space-y-2 hover:border-emerald-300"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-navy-900">{trip.process_number}</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-300">
                    Confirmado
                  </span>
                </div>
                <div className="text-xs font-semibold text-slate-800 truncate">
                  {trip.requester_name} ({trip.macro_unit})
                </div>
                <div className="text-[11px] text-slate-500">
                  {getCityName(trip.origin_city_id)} ➔ {getCityName(trip.destination_city_id)} ({trip.estimated_km} km)
                </div>
                <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-[10px] text-slate-600">
                  <span>Saída: <strong>{departureFormatted}</strong></span>
                  <span>{vehicle ? vehicle.plate : 'Frota'}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
};

export default DashboardOverview;
