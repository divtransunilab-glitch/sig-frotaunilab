import React, { useState } from 'react';
import { TripRequest, Vehicle, Driver, Contractor } from '../../types';
import { RideGroupingService, GroupingOpportunity } from '../../services/rideGroupingService';
import { FleetService } from '../../services/fleetService';
import { safeFormatDate } from '../../utils/dateUtils';
import { 
  X, 
  Car, 
  Users, 
  MapPin, 
  Calendar, 
  Clock, 
  CheckCircle2, 
  Sparkles, 
  TrendingDown, 
  Fuel, 
  SendHorizontal, 
  Truck, 
  User, 
  Building2,
  ChevronRight,
  ShieldCheck,
  Search,
  Filter
} from 'lucide-react';

interface TripGroupingModalProps {
  trips: TripRequest[];
  isOpen: boolean;
  onClose: () => void;
  onGroupDispatched: () => void;
  onSelectTripDetail: (trip: TripRequest) => void;
}

const MONTH_OPTIONS = [
  { id: 'ALL', label: 'Todos os Meses' },
  { id: '1', label: 'Janeiro' },
  { id: '2', label: 'Fevereiro' },
  { id: '3', label: 'Março' },
  { id: '4', label: 'Abril' },
  { id: '5', label: 'Maio' },
  { id: '6', label: 'Junho' },
  { id: '7', label: 'Julho' },
  { id: '8', label: 'Agosto' },
  { id: '9', label: 'Setembro' },
  { id: '10', label: 'Outubro' },
  { id: '11', label: 'Novembro' },
  { id: '12', label: 'Dezembro' },
];

export const TripGroupingModal: React.FC<TripGroupingModalProps> = ({
  trips,
  isOpen,
  onClose,
  onGroupDispatched,
  onSelectTripDetail,
}) => {
  if (!isOpen) return null;

  const vehicles = FleetService.getVehicles();
  const drivers = FleetService.getDrivers();
  const contractors = FleetService.getContractors();

  // Filtros de Data / Mês / Ano
  const [selectedYear, setSelectedYear] = useState<string>('2026');
  const [selectedMonth, setSelectedMonth] = useState<string>('9'); // Default: Setembro (mês 9)
  const [groupStatusFilter, setGroupStatusFilter] = useState<'ALL' | 'PENDING_ONLY' | 'GROUPED_ONLY'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOppId, setSelectedOppId] = useState<string | null>(null);

  // Estados de alocação para o grupo selecionado
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [selectedContractorId, setSelectedContractorId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Helper para extrair ano e mês com suporte a ISO e formato brasileiro
  const extractDateParts = (dateVal?: string | Date | null) => {
    if (!dateVal) return null;
    if (typeof dateVal === 'string') {
      const clean = dateVal.trim();
      const isoMatch = clean.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
      if (isoMatch) {
        return {
          year: parseInt(isoMatch[1], 10),
          month: parseInt(isoMatch[2], 10),
          day: parseInt(isoMatch[3], 10),
        };
      }
      const brMatch = clean.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
      if (brMatch) {
        return {
          year: parseInt(brMatch[3], 10),
          month: parseInt(brMatch[2], 10),
          day: parseInt(brMatch[1], 10),
        };
      }
    }
    try {
      const d = typeof dateVal === 'string' ? new Date(dateVal) : dateVal;
      if (d instanceof Date && !isNaN(d.getTime())) {
        return {
          year: d.getFullYear(),
          month: d.getMonth() + 1,
          day: d.getDate(),
        };
      }
    } catch {}
    return null;
  };

  // Anos disponíveis nas viagens
  const availableYears = React.useMemo(() => {
    const set = new Set<string>();
    trips.forEach((t) => {
      const p = extractDateParts(t.departure_datetime);
      if (p) set.add(p.year.toString());
    });
    if (set.size === 0) set.add('2026');
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [trips]);

  // Viagens filtradas pelo Mês e Ano selecionados
  const scopedTrips = React.useMemo(() => {
    return trips.filter((t) => {
      const p = extractDateParts(t.departure_datetime);
      if (!p) return false;
      if (selectedYear !== 'ALL' && p.year.toString() !== selectedYear) return false;
      if (selectedMonth !== 'ALL' && p.month.toString() !== selectedMonth) return false;
      return true;
    });
  }, [trips, selectedYear, selectedMonth]);

  // Identificação de oportunidades de agrupamento no escopo do mês
  const opportunities = React.useMemo(() => {
    return RideGroupingService.findGroupingOpportunities(scopedTrips);
  }, [scopedTrips]);

  // Estatísticas de economia para o período selecionado
  const totalKmSaved = React.useMemo(() => {
    return opportunities.reduce((sum, opp) => sum + opp.estimatedKmSaved, 0);
  }, [opportunities]);

  const totalCostSaved = React.useMemo(() => {
    return opportunities.reduce((sum, opp) => sum + opp.estimatedCostSaved, 0);
  }, [opportunities]);

  const totalGroupedPax = React.useMemo(() => {
    return opportunities.reduce((sum, opp) => sum + opp.totalPassengers, 0);
  }, [opportunities]);

  // Oportunidades filtradas por busca e status
  const filteredOpportunities = React.useMemo(() => {
    return opportunities.filter((opp) => {
      if (groupStatusFilter === 'PENDING_ONLY' && opp.isFullyGrouped) return false;
      if (groupStatusFilter === 'GROUPED_ONLY' && !opp.isFullyGrouped) return false;

      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase().trim();
      return (
        opp.originName.toLowerCase().includes(term) ||
        opp.destinationName.toLowerCase().includes(term) ||
        opp.dateFormatted.includes(term) ||
        opp.trips.some((t) => 
          t.requester_name.toLowerCase().includes(term) ||
          t.process_number.toLowerCase().includes(term) ||
          t.macro_unit.toLowerCase().includes(term)
        )
      );
    });
  }, [opportunities, groupStatusFilter, searchTerm]);

  const handleSelectOpportunity = (opp: GroupingOpportunity) => {
    setSelectedOppId(opp.id);
    
    // Auto-preenche com a contratada padrão e se houver veículo/motorista já sugerido
    const defaultContractor = contractors[0]?.id || '';
    setSelectedContractorId(defaultContractor);

    // Sugestão de veículo pela capacidade
    const matchingVehicle = vehicles.find((v) => v.capacity >= opp.totalPassengers && v.is_active) || vehicles[0];
    if (matchingVehicle) {
      setSelectedVehicleId(matchingVehicle.id);
      setSelectedContractorId(matchingVehicle.contractor_id || defaultContractor);
    }

    const availableDriver = drivers.find((d) => d.is_active) || drivers[0];
    if (availableDriver) {
      setSelectedDriverId(availableDriver.id);
    }
  };

  const handleConfirmGroupDispatch = (opp: GroupingOpportunity) => {
    if (!selectedVehicleId || !selectedDriverId || !selectedContractorId) {
      alert('Por favor, selecione o Veículo, Motorista e Contratada para realizar o agrupamento.');
      return;
    }

    setIsSubmitting(true);
    try {
      RideGroupingService.groupAndDispatchTrips(opp, {
        contractorId: selectedContractorId,
        driverId: selectedDriverId,
        vehicleId: selectedVehicleId,
      });

      onGroupDispatched();
      setSelectedOppId(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 overflow-y-auto animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="p-5 bg-navy-950 text-white flex items-center justify-between gap-4 border-b border-navy-900">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-brand-600/30 text-brand-400 border border-brand-500/30">
              <Sparkles className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold">Agrupador Inteligente de Viagens</h2>
                <span className="text-xs font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                  <Car className="w-3 h-3" />
                  Carona Solidária Institucional
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Otimize a frota unificando solicitações com mesma rota e data em um único veículo
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter Toolbar */}
        <div className="bg-slate-100/90 border-b border-slate-200 p-3 sm:px-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <div className="flex items-center gap-1.5 font-bold text-slate-700">
              <Calendar className="w-3.5 h-3.5 text-brand-600" />
              <span>Filtrar Período:</span>
            </div>

            {/* Ano */}
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-800 focus:outline-none focus:border-brand-500 shadow-2xs cursor-pointer"
            >
              <option value="ALL">Todos os Anos</option>
              {availableYears.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>

            {/* Mês */}
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-bold text-brand-900 focus:outline-none focus:border-brand-500 shadow-2xs cursor-pointer"
            >
              {MONTH_OPTIONS.map((m) => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </select>

            {/* Status do Grupo */}
            <div className="hidden sm:flex items-center gap-1 bg-white border border-slate-300 rounded-lg p-0.5 shadow-2xs ml-1">
              <button
                type="button"
                onClick={() => setGroupStatusFilter('ALL')}
                className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all ${
                  groupStatusFilter === 'ALL'
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Todos
              </button>
              <button
                type="button"
                onClick={() => setGroupStatusFilter('PENDING_ONLY')}
                className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all ${
                  groupStatusFilter === 'PENDING_ONLY'
                    ? 'bg-amber-600 text-white'
                    : 'text-amber-800 hover:text-amber-950'
                }`}
              >
                Com Pendência
              </button>
              <button
                type="button"
                onClick={() => setGroupStatusFilter('GROUPED_ONLY')}
                className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all ${
                  groupStatusFilter === 'GROUPED_ONLY'
                    ? 'bg-emerald-600 text-white'
                    : 'text-emerald-800 hover:text-emerald-950'
                }`}
              >
                Agrupados
              </button>
            </div>
          </div>

          {/* Quick search input */}
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar processo, cidade..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8.5 pr-3 py-1 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-brand-500 shadow-2xs"
            />
          </div>
        </div>

        {/* Metrics Banner */}
        <div className="bg-slate-50 border-b border-slate-200 p-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs">
            <div className="text-[11px] text-slate-500 font-semibold flex items-center gap-1">
              <Car className="w-3.5 h-3.5 text-brand-600" />
              <span>Grupos Coincidentes</span>
            </div>
            <div className="text-xl font-extrabold text-navy-950 mt-1">
              {opportunities.length}
            </div>
            <div className="text-[10px] text-slate-500">no período selecionado</div>
          </div>

          <div className="bg-white p-3 rounded-xl border border-emerald-200/80 bg-emerald-50/20 shadow-2xs">
            <div className="text-[11px] text-emerald-800 font-semibold flex items-center gap-1">
              <TrendingDown className="w-3.5 h-3.5 text-emerald-600" />
              <span>Quilometragem Evitada</span>
            </div>
            <div className="text-xl font-extrabold text-emerald-700 mt-1">
              {totalKmSaved.toLocaleString('pt-BR')} km
            </div>
            <div className="text-[10px] text-emerald-600">redução de rodagem duplicada</div>
          </div>

          <div className="bg-white p-3 rounded-xl border border-amber-200/80 bg-amber-50/20 shadow-2xs">
            <div className="text-[11px] text-amber-800 font-semibold flex items-center gap-1">
              <Fuel className="w-3.5 h-3.5 text-amber-600" />
              <span>Economia Estimada</span>
            </div>
            <div className="text-xl font-extrabold text-amber-700 mt-1">
              R$ {totalCostSaved.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-[10px] text-amber-700">combustível + diárias</div>
          </div>

          <div className="bg-white p-3 rounded-xl border border-blue-200/80 bg-blue-50/20 shadow-2xs">
            <div className="text-[11px] text-blue-800 font-semibold flex items-center gap-1">
              <Users className="w-3.5 h-3.5 text-blue-600" />
              <span>Passageiros Otimizados</span>
            </div>
            <div className="text-xl font-extrabold text-blue-700 mt-1">
              {totalGroupedPax}
            </div>
            <div className="text-[10px] text-blue-600">atendidos em conjunto</div>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>
              Exibindo <strong>{filteredOpportunities.length}</strong> oportunidade(s) de carona solidária
            </span>
            {selectedMonth !== 'ALL' && (
              <span className="bg-brand-50 text-brand-800 px-2 py-0.5 rounded-md font-bold text-[11px] border border-brand-200">
                {MONTH_OPTIONS.find(m => m.id === selectedMonth)?.label} / {selectedYear}
              </span>
            )}
          </div>

          {filteredOpportunities.length === 0 ? (
            <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-300 p-8 space-y-3">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
              <h3 className="font-bold text-sm text-slate-800">
                Nenhuma viagem duplicada aguardando agrupamento!
              </h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Todas as viagens coincidentes foram escaladas ou não há duas demandas para a mesma rota e data no momento.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredOpportunities.map((opp) => {
                const isSelected = selectedOppId === opp.id;

                return (
                  <div
                    key={opp.id}
                    className={`bg-white rounded-2xl border transition-all overflow-hidden ${
                      opp.isFullyGrouped
                        ? 'border-emerald-200 shadow-2xs'
                        : isSelected
                        ? 'border-brand-500 ring-2 ring-brand-500/20 shadow-md'
                        : 'border-slate-200/80 hover:border-brand-300 shadow-2xs'
                    }`}
                  >
                    {/* Opportunity Header */}
                    <div className="p-4 bg-slate-50/70 border-b border-slate-200/80 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <span className="p-2 rounded-xl bg-white border border-slate-200 shadow-2xs text-brand-700">
                          <MapPin className="w-4 h-4" />
                        </span>
                        <div>
                          <div className="font-extrabold text-sm text-navy-950 flex items-center gap-2">
                            <span>{opp.originName}</span>
                            <span className="text-slate-400">➔</span>
                            <span>{opp.destinationName}</span>
                          </div>
                          <div className="text-[11px] text-slate-500 flex flex-wrap items-center gap-x-2 gap-y-1 mt-0.5">
                            <span>Data: <strong>{opp.dateFormatted}</strong></span>
                            <span>•</span>
                            <span className="inline-flex items-center gap-1 font-semibold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded">
                              <Clock className="w-3 h-3 text-brand-600" />
                              Saída: <strong>{opp.departureTimeRange}</strong>
                            </span>
                            {opp.returnTimeRange && (
                              <span className="inline-flex items-center gap-1 font-semibold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded">
                                <Clock className="w-3 h-3 text-blue-600" />
                                Retorno: <strong>{opp.returnTimeRange}</strong>
                              </span>
                            )}
                            <span>•</span>
                            <span className="text-slate-600">{opp.trips.length} solicitações coincidentes (janela $\le$ 1h)</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {opp.isFullyGrouped ? (
                          <span className="text-[11px] font-bold px-3 py-1 rounded-xl bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Já Agrupadas no Veículo {opp.sharedVehicle?.plate}</span>
                          </span>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-extrabold px-2.5 py-1 rounded-xl bg-amber-100 text-amber-900 border border-amber-300">
                              Economiza {opp.estimatedKmSaved} km
                            </span>
                            <button
                              onClick={() => handleSelectOpportunity(opp)}
                              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                                isSelected
                                  ? 'bg-slate-800 text-white'
                                  : 'bg-brand-600 hover:bg-brand-700 text-white shadow-xs'
                              }`}
                            >
                              <span>{isSelected ? 'Ocultar Escala' : 'Agrupar Viagens'}</span>
                              <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Trips List in Group */}
                    <div className="p-4 space-y-3">
                      <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        Solicitações do Grupo ({opp.totalPassengers} passageiros no total):
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {opp.trips.map((trip) => {
                          const depTime = safeFormatDate(trip.departure_datetime, 'HH:mm', '08:00');
                          const retTime = safeFormatDate(trip.return_datetime, 'HH:mm', '18:00');
                          const isConfirmed = trip.status === 'Confirmado ao Demandante';

                          return (
                            <div
                              key={trip.id}
                              onClick={() => onSelectTripDetail(trip)}
                              className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 hover:bg-slate-100/80 cursor-pointer transition-all space-y-1.5 relative group"
                              title="Clique para ver detalhes do processo"
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-mono font-bold text-xs text-navy-950">
                                  {trip.process_number}
                                </span>
                                <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded border ${
                                  isConfirmed
                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                    : 'bg-amber-50 text-amber-800 border-amber-300'
                                }`}>
                                  {isConfirmed ? 'Confirmado' : 'Pendente'}
                                </span>
                              </div>

                              <div className="text-xs font-semibold text-slate-800 truncate">
                                {trip.requester_name}
                              </div>

                              <div className="text-[11px] text-slate-600 flex items-center justify-between">
                                <span>{trip.requesting_unit} ({trip.macro_unit})</span>
                                <span className="font-bold text-slate-800 flex items-center gap-0.5">
                                  <Users className="w-3 h-3 text-slate-400" />
                                  {trip.passenger_count} pax
                                </span>
                              </div>

                              <div className="text-[10px] text-slate-500 pt-1 border-t border-slate-200/60 flex items-center justify-between">
                                <span>Saída: <strong>{depTime}</strong></span>
                                <span>Retorno: <strong>{retTime}</strong></span>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Recommendation Box */}
                      <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-200 text-blue-950 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Truck className="w-4 h-4 text-blue-600 shrink-0" />
                          <span>
                            <strong>Recomendação de Veículo:</strong> {opp.recommendedVehicleType}
                          </span>
                        </div>
                        <div className="text-[11px] text-blue-800 font-semibold">
                          Capacidade mínima necessária: <strong>{opp.totalPassengers} assentos</strong>
                        </div>
                      </div>

                      {/* Unified Dispatch Form (Visible when opportunity is selected) */}
                      {isSelected && (
                        <div className="mt-4 p-4 rounded-xl bg-amber-50/60 border border-amber-300 space-y-4 animate-fade-in">
                          <div className="flex items-center gap-2 text-amber-950 font-bold text-xs">
                            <Sparkles className="w-4 h-4 text-amber-600" />
                            <span>Escala Unificada para as {opp.trips.length} Viagens Deste Grupo:</span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            {/* Vehicle Selector */}
                            <div className="space-y-1">
                              <label className="text-[11px] font-bold text-slate-700">
                                Veículo (Capacidade ≥ {opp.totalPassengers}):
                              </label>
                              <select
                                value={selectedVehicleId}
                                onChange={(e) => {
                                  setSelectedVehicleId(e.target.value);
                                  const v = vehicles.find((item) => item.id === e.target.value);
                                  if (v && v.contractor_id) {
                                    setSelectedContractorId(v.contractor_id);
                                  }
                                }}
                                className="w-full text-xs p-2 rounded-xl border border-slate-300 bg-white font-medium focus:ring-2 focus:ring-brand-500 focus:outline-none"
                              >
                                <option value="">Selecione o Veículo...</option>
                                {vehicles.map((v) => (
                                  <option key={v.id} value={v.id}>
                                    {v.plate} - {v.model} ({v.type} • {v.capacity}L)
                                  </option>
                                ))}
                              </select>
                            </div>

                            {/* Driver Selector */}
                            <div className="space-y-1">
                              <label className="text-[11px] font-bold text-slate-700">
                                Motorista / Condutor:
                              </label>
                              <select
                                value={selectedDriverId}
                                onChange={(e) => setSelectedDriverId(e.target.value)}
                                className="w-full text-xs p-2 rounded-xl border border-slate-300 bg-white font-medium focus:ring-2 focus:ring-brand-500 focus:outline-none"
                              >
                                <option value="">Selecione o Motorista...</option>
                                {drivers.map((d) => (
                                  <option key={d.id} value={d.id}>
                                    {d.name} (CNH {d.cnh_category})
                                  </option>
                                ))}
                              </select>
                            </div>

                            {/* Contractor Selector */}
                            <div className="space-y-1">
                              <label className="text-[11px] font-bold text-slate-700">
                                Empresa / Contratada:
                              </label>
                              <select
                                value={selectedContractorId}
                                onChange={(e) => setSelectedContractorId(e.target.value)}
                                className="w-full text-xs p-2 rounded-xl border border-slate-300 bg-white font-medium focus:ring-2 focus:ring-brand-500 focus:outline-none"
                              >
                                <option value="">Selecione a Empresa...</option>
                                {contractors.map((c) => (
                                  <option key={c.id} value={c.id}>
                                    {c.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>

                          <div className="flex items-center justify-end gap-2 pt-2 border-t border-amber-200">
                            <button
                              type="button"
                              onClick={() => setSelectedOppId(null)}
                              className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-200 transition-colors"
                            >
                              Cancelar
                            </button>

                            <button
                              type="button"
                              disabled={isSubmitting || !selectedVehicleId || !selectedDriverId}
                              onClick={() => handleConfirmGroupDispatch(opp)}
                              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-md shadow-emerald-950/20 flex items-center gap-1.5"
                            >
                              <SendHorizontal className="w-3.5 h-3.5" />
                              <span>{isSubmitting ? 'Escalando...' : '🚀 Agrupar e Escalar Viagens'}</span>
                            </button>
                          </div>
                        </div>
                      )}

                    </div>
                  </div>
                );
              })}
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-100 border-t border-slate-200 flex items-center justify-between gap-3">
          <div className="text-xs text-slate-500 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Todas as alterações são registradas na trilha de auditoria e notificam os demandantes.</span>
          </div>

          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold transition-colors"
          >
            Fechar
          </button>
        </div>

      </div>
    </div>
  );
};
