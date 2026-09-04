import React, { useState, useMemo } from 'react';
import { TripRequest, City, Vehicle, Driver, Contractor, MacroUnit } from '../../types';
import { StatusBadge } from '../common/StatusBadge';
import { ExportService } from '../../services/exportService';
import { RideGroupingService } from '../../services/rideGroupingService';
import { 
  PlusCircle, 
  Search, 
  FileSpreadsheet, 
  Eye, 
  SendHorizontal, 
  XCircle, 
  RotateCcw,
  Calendar,
  Layers,
  Table as TableIcon,
  Printer,
  Sparkles,
  Car,
  TrendingDown,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ChevronDown
} from 'lucide-react';
import { format, parseISO, getMonth, getYear, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface DispatchQueueProps {
  trips: TripRequest[];
  cities: City[];
  vehicles: Vehicle[];
  drivers: Driver[];
  contractors: Contractor[];
  onSelectTripDetail: (trip: TripRequest) => void;
  onOpenDispatchModal: (trip: TripRequest) => void;
  onOpenRejectModal: (trip: TripRequest) => void;
  onOpenChangeDateModal?: (trip: TripRequest) => void;
  onOpenDeleteModal?: (trip: TripRequest) => void;
  onOpenNewTripModal: () => void;
  onOpenImportModal?: () => void;
  onOpenTrafficOrderModal?: (trip: TripRequest) => void;
  onOpenGroupingModal?: () => void;
}

export const DispatchQueue: React.FC<DispatchQueueProps> = ({
  trips,
  cities,
  vehicles,
  drivers,
  contractors,
  onSelectTripDetail,
  onOpenDispatchModal,
  onOpenRejectModal,
  onOpenChangeDateModal,
  onOpenDeleteModal,
  onOpenNewTripModal,
  onOpenImportModal,
  onOpenTrafficOrderModal,
  onOpenGroupingModal,
}) => {
  // Aba de Mês Selecionado (Inicia no mês vigente, ex: '09-2026' ou 'MM-yyyy')
  const [selectedMonthTab, setSelectedMonthTab] = useState<string>(() => {
    const now = new Date();
    const m = (getMonth(now) + 1).toString().padStart(2, '0');
    const y = getYear(now);
    return `${m}-${y}`;
  });
  
  // Modo de Exibição: 'compact' (Resumo Operacional - Padrão) ou 'full' (Planilha Completa 26 colunas)
  const [viewMode, setViewMode] = useState<'full' | 'compact'>('compact');

  // Filtros Avançados
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [macroFilter, setMacroFilter] = useState('ALL');
  const [activityFilter, setActivityFilter] = useState('ALL');
  const [deadlineFilter, setDeadlineFilter] = useState('ALL');

  // Contagem de demandas por mês
  const countByMonth = useMemo(() => {
    const map: Record<string, number> = { ALL: trips.length };
    trips.forEach((t) => {
      try {
        const d = parseISO(t.departure_datetime);
        if (isValid(d)) {
          const m = (getMonth(d) + 1).toString().padStart(2, '0');
          const y = getYear(d);
          const key = `${m}-${y}`;
          map[key] = (map[key] || 0) + 1;
        }
      } catch {
        // ignore
      }
    });
    return map;
  }, [trips]);

  // Lista dos 12 meses do ano para o botão de lista otimizado
  const monthsList = useMemo(() => {
    const defaultMonths = [
      { id: 'ALL', label: 'Todas as Demandas (Consolidado Anual)', monthIndex: -1 },
      { id: '01-2026', label: '01-2026 (Janeiro)', monthIndex: 0 },
      { id: '02-2026', label: '02-2026 (Fevereiro)', monthIndex: 1 },
      { id: '03-2026', label: '03-2026 (Março)', monthIndex: 2 },
      { id: '04-2026', label: '04-2026 (Abril)', monthIndex: 3 },
      { id: '05-2026', label: '05-2026 (Maio)', monthIndex: 4 },
      { id: '06-2026', label: '06-2026 (Junho)', monthIndex: 5 },
      { id: '07-2026', label: '07-2026 (Julho)', monthIndex: 6 },
      { id: '08-2026', label: '08-2026 (Agosto)', monthIndex: 7 },
      { id: '09-2026', label: '09-2026 (Setembro)', monthIndex: 8 },
      { id: '10-2026', label: '10-2026 (Outubro)', monthIndex: 9 },
      { id: '11-2026', label: '11-2026 (Novembro)', monthIndex: 10 },
      { id: '12-2026', label: '12-2026 (Dezembro)', monthIndex: 11 },
    ];

    const extraMonthKeys = Object.keys(countByMonth).filter(
      (k) => k !== 'ALL' && !defaultMonths.some((item) => item.id === k) && countByMonth[k] > 0
    );

    extraMonthKeys.sort().forEach((k) => {
      defaultMonths.push({
        id: k,
        label: k,
        monthIndex: parseInt(k.split('-')[0], 10) - 1,
      });
    });

    return defaultMonths;
  }, [countByMonth]);

  // Helpers de navegação rápida entre meses
  const currentMonthIndex = useMemo(() => {
    return monthsList.findIndex((m) => m.id === selectedMonthTab);
  }, [monthsList, selectedMonthTab]);

  const handlePrevMonth = () => {
    if (currentMonthIndex > 0) {
      setSelectedMonthTab(monthsList[currentMonthIndex - 1].id);
    }
  };

  const handleNextMonth = () => {
    if (currentMonthIndex !== -1 && currentMonthIndex < monthsList.length - 1) {
      setSelectedMonthTab(monthsList[currentMonthIndex + 1].id);
    }
  };

  const macroUnitsList: MacroUnit[] = [
    'ICS', 'IDR', 'PROADI', 'PROPAE', 'ICEN', 'GR', 'PROEX', 'IH', 'PROINTER', 'ICSA', 'SECOM', 'PROPPG', 'DTI'
  ];

  // Helper de Formatação Segura de Datas
  const safeFormatDate = (dateStr?: string, formatStr: string = 'dd/MM/yyyy', fallback: string = '-'): string => {
    if (!dateStr) return fallback;
    try {
      const d = parseISO(dateStr);
      if (!isValid(d) || isNaN(d.getTime())) return fallback;
      return format(d, formatStr, { locale: ptBR });
    } catch {
      return fallback;
    }
  };

  // Helpers de Resolução de IDs
  const getCityName = (cityId: string) => {
    const city = cities.find((c) => c.id === cityId);
    return city ? `${city.name}` : cityId;
  };

  const getVehicleData = (vehicleId?: string) => {
    return vehicles.find((v) => v.id === vehicleId);
  };

  const getDriverData = (driverId?: string) => {
    return drivers.find((d) => d.id === driverId);
  };

  const getContractorData = (contractorId?: string) => {
    return contractors.find((c) => c.id === contractorId);
  };

  // Filtragem dos Registros
  const filteredTrips = useMemo(() => {
    return trips.filter((trip) => {
      // Filtro por Mês (Abas da Planilha)
      if (selectedMonthTab !== 'ALL') {
        try {
          const d = parseISO(trip.departure_datetime);
          if (isValid(d)) {
            const m = (getMonth(d) + 1).toString().padStart(2, '0');
            const y = getYear(d);
            const monthKey = `${m}-${y}`;
            if (monthKey !== selectedMonthTab) return false;
          } else {
            return false;
          }
        } catch {
          return false;
        }
      }

      // Busca Textual
      if (searchTerm.trim() !== '') {
        const term = searchTerm.toLowerCase().trim();
        const match =
          trip.process_number.toLowerCase().includes(term) ||
          trip.requester_name.toLowerCase().includes(term) ||
          trip.requester_email.toLowerCase().includes(term) ||
          trip.macro_unit.toLowerCase().includes(term) ||
          trip.requesting_unit.toLowerCase().includes(term);
        if (!match) return false;
      }

      // Filtro de Status
      if (statusFilter !== 'ALL' && trip.status !== statusFilter) return false;

      // Filtro de Macro Unidade
      if (macroFilter !== 'ALL' && trip.macro_unit !== macroFilter) return false;

      // Filtro de Atividade
      if (activityFilter !== 'ALL' && trip.activity_type !== activityFilter) return false;

      // Filtro de Prazo
      if (deadlineFilter !== 'ALL' && trip.status_deadline !== deadlineFilter) return false;

      return true;
    }).sort((a, b) => {
      const timeA = new Date(a.departure_datetime).getTime() || 0;
      const timeB = new Date(b.departure_datetime).getTime() || 0;
      if (timeA !== timeB) return timeA - timeB;
      return a.process_number.localeCompare(b.process_number);
    });
  }, [trips, selectedMonthTab, searchTerm, statusFilter, macroFilter, activityFilter, deadlineFilter]);

  const handleResetFilters = () => {
    setSearchTerm('');
    setStatusFilter('ALL');
    setMacroFilter('ALL');
    setActivityFilter('ALL');
    setDeadlineFilter('ALL');
  };

  const handleExportFiltered = () => {
    const filename = selectedMonthTab === 'ALL'
      ? `SIG-FROTA_Consolidado_Geral_${format(new Date(), 'yyyyMMdd')}.xlsx`
      : `SIG-FROTA_Mes_${selectedMonthTab}_${format(new Date(), 'yyyyMMdd')}.xlsx`;

    ExportService.exportToExcel(filteredTrips, filename);
  };

  // Oportunidades de Carona Solidária / Agrupamento de Viagens
  const opportunities = useMemo(() => {
    return RideGroupingService.findGroupingOpportunities(filteredTrips);
  }, [filteredTrips]);

  const totalKmSaved = useMemo(() => {
    return opportunities.reduce((sum, opp) => sum + opp.estimatedKmSaved, 0);
  }, [opportunities]);

  return (
    <div className="space-y-4 sm:space-y-5">
      
      {/* Header com Estatísticas e Ações Rápidas */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-brand-600" />
            <h2 className="text-xl font-extrabold text-navy-950">
              Controle Operacional de Viagens
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Gerencie, escale frotas, emita ordens de tráfego e agrupe caronas institucionais
          </p>
        </div>

        {/* Botões de Ação Topo */}
        <div className="flex flex-wrap items-center gap-2">
          {opportunities.length > 0 && onOpenGroupingModal && (
            <button
              onClick={onOpenGroupingModal}
              className="px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5"
            >
              <Sparkles className="w-4 h-4 text-slate-950" />
              <span>Agrupar Viagens ({opportunities.length})</span>
            </button>
          )}

          {onOpenImportModal && (
            <button
              onClick={onOpenImportModal}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              <span>Importar Planilha</span>
            </button>
          )}

          <button
            onClick={handleExportFiltered}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Exportar Excel</span>
          </button>

          <button
            onClick={onOpenNewTripModal}
            className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold rounded-xl shadow-md shadow-brand-600/30 transition-all flex items-center gap-1.5"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Nova Solicitação</span>
          </button>
        </div>
      </div>

      {/* Seletor Otimizado de Mês da Planilha em Botão de Lista / Dropdown com Navegação */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 bg-slate-100/90 px-3 py-2 rounded-xl border border-slate-200/90">
              <Calendar className="w-4 h-4 text-brand-600 shrink-0" />
              <span>Aba Mensal da Planilha:</span>
            </div>

            {/* Botão de Lista / Dropdown de Seleção do Mês + Navegação por Setas */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handlePrevMonth}
                disabled={currentMonthIndex <= 0}
                className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                title="Mês Anterior"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div className="relative">
                <select
                  value={selectedMonthTab}
                  onChange={(e) => setSelectedMonthTab(e.target.value)}
                  className="appearance-none bg-brand-50/70 hover:bg-brand-100/70 border border-brand-200 text-brand-950 font-bold text-xs rounded-xl pl-3.5 pr-9 py-2 focus:outline-hidden focus:ring-2 focus:ring-brand-500 shadow-xs cursor-pointer transition-colors"
                >
                  {monthsList.map((tab) => {
                    const count = countByMonth[tab.id] || 0;
                    return (
                      <option key={tab.id} value={tab.id}>
                        {tab.label} — [{count} {count === 1 ? 'solicitação' : 'solicitações'}]
                      </option>
                    );
                  })}
                </select>
                <ChevronDown className="w-4 h-4 text-brand-700 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>

              <button
                type="button"
                onClick={handleNextMonth}
                disabled={currentMonthIndex === -1 || currentMonthIndex >= monthsList.length - 1}
                className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                title="Próximo Mês"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Alternador de Modo de Visualização */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200">
            <button
              onClick={() => setViewMode('compact')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                viewMode === 'compact'
                  ? 'bg-white text-navy-950 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>Resumo Operacional</span>
            </button>
            <button
              onClick={() => setViewMode('full')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                viewMode === 'full'
                  ? 'bg-white text-navy-950 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <TableIcon className="w-3.5 h-3.5" />
              <span>Planilha Completa</span>
            </button>
          </div>
        </div>
      </div>

      {/* Painel de Busca e Filtros Avançados */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          
          {/* Busca Textual */}
          <div className="lg:col-span-2 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar por processo, solicitante, destino, unidade..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:bg-white focus:border-brand-500 focus:outline-hidden"
            />
          </div>

          {/* Filtro de Situação / Status */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:bg-white focus:border-brand-500 focus:outline-hidden"
            >
              <option value="ALL">Todas as Situações</option>
              <option value="Pendente de Análise">Pendente de Análise</option>
              <option value="Confirmado ao Demandante">Confirmado ao Demandante</option>
              <option value="Indeferido">Indeferido</option>
              <option value="Alterado a Data da Demanda">Data Alterada</option>
              <option value="Cancelado pelo Demandante">Cancelado pelo Demandante</option>
              <option value="Cancelado pela Unidade Executante">Cancelado pela Executante</option>
            </select>
          </div>

          {/* Filtro de Macro Unidade */}
          <div>
            <select
              value={macroFilter}
              onChange={(e) => setMacroFilter(e.target.value)}
              className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:bg-white focus:border-brand-500 focus:outline-hidden"
            >
              <option value="ALL">Todas as Macro Unidades</option>
              {macroUnitsList.map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </div>

          {/* Filtro de Prazo (Dentro / Fora) */}
          <div>
            <select
              value={deadlineFilter}
              onChange={(e) => setDeadlineFilter(e.target.value)}
              className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:bg-white focus:border-brand-500 focus:outline-hidden"
            >
              <option value="ALL">Todos os Prazos</option>
              <option value="Dentro do Prazo">Dentro do Prazo (≥ 5d)</option>
              <option value="Fora do Prazo">Fora do Prazo (&lt; 5d)</option>
            </select>
          </div>

          {/* Botão Limpar Filtros */}
          <div>
            <button
              onClick={handleResetFilters}
              className="w-full py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Limpar Filtros</span>
            </button>
          </div>

        </div>
      </div>

      {/* Banner de Oportunidades de Agrupamento / Carona Solidária */}
      {opportunities.length > 0 && onOpenGroupingModal && (
        <div className="bg-gradient-to-r from-amber-500/15 via-emerald-500/10 to-blue-500/10 rounded-2xl border border-amber-300/80 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500 text-white shadow-xs shrink-0">
              <Sparkles className="w-5 h-5 text-slate-950" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-extrabold text-xs text-navy-950">
                  {opportunities.length} {opportunities.length === 1 ? 'Oportunidade' : 'Oportunidades'} de Carona Solidária Identificadas!
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                  Economia de até {totalKmSaved.toLocaleString('pt-BR')} km
                </span>
              </div>
              <p className="text-[11px] text-slate-600 mt-0.5">
                Existem solicitações para o mesmo destino e data que podem compartilhar o mesmo veículo e condutor.
              </p>
            </div>
          </div>

          <button
            onClick={onOpenGroupingModal}
            className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-950 text-white text-xs font-bold transition-all shadow-md flex items-center justify-center gap-1.5 whitespace-nowrap self-start sm:self-auto shrink-0"
          >
            <Car className="w-3.5 h-3.5 text-amber-400" />
            <span>Ver Agrupamentos & Otimizar</span>
          </button>
        </div>
      )}

      {/* Main Data Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card overflow-hidden">
        <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-extrabold text-navy-950 uppercase tracking-wider">
              {selectedMonthTab === 'ALL' ? 'Consolidado Anual' : `Mês: ${selectedMonthTab}`}
            </span>
            <span className="text-xs font-bold text-slate-500">
              ({filteredTrips.length} solicitações)
            </span>
          </div>
          <span className="text-[11px] text-slate-500 hidden sm:inline">
            Clique no número do processo para ficha detalhada ou em "Escalar Demanda"
          </span>
        </div>

        {/* TABELA MODO 1: PLANILHA COMPLETA (26 COLUNAS CADASTRADAS) */}
        {viewMode === 'full' ? (
          <div className="overflow-x-auto max-w-full">
            <table className="w-full text-left border-collapse text-xs whitespace-nowrap">
              <thead>
                <tr className="bg-slate-100/90 border-b border-slate-200 text-[10.5px] font-extrabold text-slate-700 uppercase tracking-wider">
                  <th className="py-2.5 px-3 pl-4 sticky left-0 bg-slate-100 z-10">Item</th>
                  <th className="py-2.5 px-3 sticky left-12 bg-slate-100 z-10">Processo</th>
                  <th className="py-2.5 px-3">Data Recebimento</th>
                  <th className="py-2.5 px-2 text-center">Dias Anteced.</th>
                  <th className="py-2.5 px-2">Dia Semana</th>
                  <th className="py-2.5 px-3">Status Prazo</th>
                  <th className="py-2.5 px-3">Tipo Atividade</th>
                  <th className="py-2.5 px-3">Solicitante</th>
                  <th className="py-2.5 px-2">Unidade Macro</th>
                  <th className="py-2.5 px-3">Unidade Requisitante</th>
                  <th className="py-2.5 px-3">Partida</th>
                  <th className="py-2.5 px-3">Destino</th>
                  <th className="py-2.5 px-3">Data Saída</th>
                  <th className="py-2.5 px-2">Hora Saída</th>
                  <th className="py-2.5 px-3">Data Retorno</th>
                  <th className="py-2.5 px-2">Hora Retorno</th>
                  <th className="py-2.5 px-2 text-center">Pax</th>
                  <th className="py-2.5 px-2 text-center">KM Total</th>
                  <th className="py-2.5 px-3">Contratada</th>
                  <th className="py-2.5 px-3">Motorista</th>
                  <th className="py-2.5 px-2">Categoria</th>
                  <th className="py-2.5 px-3">Tipo Veículo</th>
                  <th className="py-2.5 px-3">Veículo</th>
                  <th className="py-2.5 px-2">Placa</th>
                  <th className="py-2.5 px-3">Situação</th>
                  <th className="py-2.5 px-3">Observação</th>
                  <th className="py-2.5 px-3">Relatório Viagem</th>
                  <th className="py-2.5 px-3 pr-4 text-right sticky right-0 bg-slate-100 z-10">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-[11px]">
                {filteredTrips.length === 0 ? (
                  <tr>
                    <td colSpan={28} className="p-10 text-center text-slate-400">
                      Nenhuma solicitação encontrada para o mês / filtros selecionados.
                    </td>
                  </tr>
                ) : (
                  filteredTrips.map((trip, idx) => {
                    const veh = getVehicleData(trip.allocated_vehicle_id);
                    const driver = getDriverData(trip.allocated_driver_id);
                    const contractor = getContractorData(trip.allocated_contractor_id);

                    const dayOfWeek = safeFormatDate(trip.departure_datetime, 'EEEE', 'Segunda-feira');
                    const isConfirmed = trip.status === 'Confirmado ao Demandante';

                    return (
                      <tr key={trip.id} className="hover:bg-slate-50/90 transition-colors group">
                        
                        {/* 1. Item # */}
                        <td className="py-2.5 px-3 pl-4 font-bold text-slate-500 sticky left-0 bg-white group-hover:bg-slate-50/90 z-10">
                          {idx + 1}
                        </td>

                        {/* 2. Processo */}
                        <td className="py-2.5 px-3 font-bold text-navy-950 sticky left-12 bg-white group-hover:bg-slate-50/90 z-10 font-mono">
                          <span
                            onClick={() => onSelectTripDetail(trip)}
                            className="hover:text-brand-600 cursor-pointer underline decoration-dotted"
                          >
                            {trip.process_number}
                          </span>
                        </td>

                        {/* 3. Data Recebimento */}
                        <td className="py-2.5 px-3 text-slate-700">
                          {safeFormatDate(trip.received_at, 'dd/MM/yyyy HH:mm', '-')}
                        </td>

                        {/* 4. Dias de Antecedência */}
                        <td className="py-2.5 px-2 text-center font-bold text-slate-800">
                          {trip.advance_days}d
                        </td>

                        {/* 5. Dia da Semana */}
                        <td className="py-2.5 px-2 text-slate-600 capitalize">
                          {dayOfWeek}
                        </td>

                        {/* 6. Status Prazo */}
                        <td className="py-2.5 px-3">
                          <StatusBadge deadline={trip.status_deadline} />
                        </td>

                        {/* 7. Tipo Atividade */}
                        <td className="py-2.5 px-3 font-medium text-slate-800">
                          {trip.activity_type}
                        </td>

                        {/* 8. Solicitante */}
                        <td className="py-2.5 px-3 font-semibold text-slate-900 max-w-[160px] truncate" title={trip.requester_name}>
                          {trip.requester_name}
                        </td>

                        {/* 9. Unidade Macro */}
                        <td className="py-2.5 px-2 font-bold text-slate-800">
                          {trip.macro_unit}
                        </td>

                        {/* 10. Unidade Requisitante */}
                        <td className="py-2.5 px-3 text-slate-600 max-w-[150px] truncate" title={trip.requesting_unit}>
                          {trip.requesting_unit}
                        </td>

                        {/* 11. Partida */}
                        <td className="py-2.5 px-3 font-medium text-slate-800">
                          {getCityName(trip.origin_city_id)}
                        </td>

                        {/* 12. Destino */}
                        <td className="py-2.5 px-3 font-bold text-slate-900">
                          <span>{getCityName(trip.destination_city_id)}</span>
                          {trip.intermediate_cities && trip.intermediate_cities.length > 0 && (
                            <span className="block text-[9.5px] font-bold text-amber-700">
                              +{trip.intermediate_cities.length} parada(s)
                            </span>
                          )}
                          {trip.extra_km ? (
                            <span className="block text-[9.5px] font-bold text-amber-700">
                              +{trip.extra_km} km local
                            </span>
                          ) : null}
                        </td>

                        {/* 13. Data Saída */}
                        <td className="py-2.5 px-3 text-slate-800 font-semibold">
                          {safeFormatDate(trip.departure_datetime, 'dd/MM/yyyy', '-')}
                        </td>

                        {/* 14. Hora Saída */}
                        <td className="py-2.5 px-2 text-slate-700 font-bold">
                          {safeFormatDate(trip.departure_datetime, 'HH:mm', '08:00')}
                        </td>

                        {/* 15. Data Retorno */}
                        <td className="py-2.5 px-3 text-slate-800">
                          {safeFormatDate(trip.return_datetime, 'dd/MM/yyyy', '-')}
                        </td>

                        {/* 16. Hora Retorno */}
                        <td className="py-2.5 px-2 text-slate-700">
                          {safeFormatDate(trip.return_datetime, 'HH:mm', '18:00')}
                        </td>

                        {/* 17. Quant. Passageiros */}
                        <td className="py-2.5 px-2 text-center font-extrabold text-slate-900">
                          {trip.passenger_count}
                        </td>

                        {/* 18. KM Total */}
                        <td className="py-2.5 px-2 text-center font-bold text-brand-700 bg-brand-50/40">
                          {trip.estimated_km} km
                        </td>

                        {/* 19. Contratada */}
                        <td className="py-2.5 px-3 text-slate-700 max-w-[140px] truncate">
                          {contractor ? contractor.name.split(' ')[0] : '-'}
                        </td>

                        {/* 20. Motorista */}
                        <td className="py-2.5 px-3 font-semibold text-slate-800 max-w-[140px] truncate">
                          {driver ? driver.name : '-'}
                        </td>

                        {/* 21. Categoria */}
                        <td className="py-2.5 px-2 text-slate-600">
                          {driver ? `Cat. ${driver.cnh_category}` : '-'}
                        </td>

                        {/* 22. Tipo Veículo */}
                        <td className="py-2.5 px-3 text-slate-700">
                          {veh ? veh.type : '-'}
                        </td>

                        {/* 23. Veículo */}
                        <td className="py-2.5 px-3 text-slate-800 max-w-[130px] truncate">
                          {veh ? veh.model : '-'}
                        </td>

                        {/* 24. Placa */}
                        <td className="py-2.5 px-2 font-mono font-bold text-navy-950">
                          {veh ? veh.plate : '-'}
                        </td>

                        {/* 25. Situação */}
                        <td className="py-2.5 px-3">
                          <StatusBadge status={trip.status} />
                        </td>

                        {/* 26. Observação */}
                        <td className="py-2.5 px-3 text-slate-500 max-w-[150px] truncate" title={trip.notes || trip.trip_objective}>
                          {trip.notes || trip.trip_objective || '-'}
                        </td>

                        {/* 27. Situação Relatório Viagem */}
                        <td className="py-2.5 px-3 text-[10.5px]">
                          {trip.travel_report_status ? (
                            <StatusBadge reportStatus={trip.travel_report_status} />
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>

                        {/* 28. Ações */}
                        <td className="py-2.5 px-3 pr-4 text-right sticky right-0 bg-white group-hover:bg-slate-50/90 z-10">
                          <div className="flex items-center justify-end gap-1">
                            {isConfirmed && (
                              <button
                                onClick={() => {
                                  if (onOpenTrafficOrderModal) {
                                    onOpenTrafficOrderModal(trip);
                                  } else {
                                    ExportService.exportTrafficOrderPDF(trip);
                                  }
                                }}
                                title="Emitir Ordem de Tráfego (PDF)"
                                className="p-1 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 rounded-lg transition-colors"
                              >
                                <Printer className="w-3.5 h-3.5" />
                              </button>
                            )}

                            <button
                              onClick={() => onSelectTripDetail(trip)}
                              title="Ver Ficha Detalhada"
                              className="p-1 text-slate-500 hover:text-slate-900 hover:bg-slate-200/70 rounded-lg transition-colors"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={() => onOpenDispatchModal(trip)}
                              title={isConfirmed ? 'Alterar escala de frota' : 'Escalar motorista e veículo'}
                              className={`px-2.5 py-1 rounded-lg text-[10.5px] font-bold text-white shadow-xs flex items-center gap-1 transition-all active:scale-95 whitespace-nowrap ${
                                isConfirmed
                                  ? 'bg-slate-700 hover:bg-slate-800'
                                  : 'bg-brand-600 hover:bg-brand-700'
                              }`}
                            >
                              <SendHorizontal className="w-3 h-3" />
                              <span>{isConfirmed ? 'Re-escalar' : 'Escalar Demanda'}</span>
                            </button>

                            <button
                              onClick={() => onOpenRejectModal(trip)}
                              title="Indeferir Demanda"
                              className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                            </button>

                            {onOpenDeleteModal && (
                              <button
                                onClick={() => onOpenDeleteModal(trip)}
                                title="Excluir Solicitação (Exige Senha)"
                                className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>

                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        ) : (
          /* TABELA MODO 2: OPERACIONAL RESUMIDA */
          <div className="overflow-x-auto max-w-full">
            <table className="w-full text-left border-collapse text-xs whitespace-nowrap">
              <thead>
                <tr className="bg-slate-100/90 border-b border-slate-200 text-[10.5px] font-extrabold text-slate-700 uppercase tracking-wider">
                  <th className="py-2.5 px-3 pl-4 sticky left-0 bg-slate-100 z-10">Nº Processo</th>
                  <th className="py-2.5 px-2">Solicitante & Unidade</th>
                  <th className="py-2.5 px-2">Trecho</th>
                  <th className="py-2.5 px-2">Saída / Retorno</th>
                  <th className="py-2.5 px-2 text-center">Pax</th>
                  <th className="py-2.5 px-2 text-center">KM</th>
                  <th className="py-2.5 px-2">Antecedência</th>
                  <th className="py-2.5 px-2">Situação</th>
                  <th className="py-2.5 px-2">Alocação</th>
                  <th className="py-2.5 px-3 text-right pr-4 sticky right-0 bg-slate-100 z-10 border-l border-slate-200/70">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-[11px]">
                {filteredTrips.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="p-8 text-center text-slate-400">
                      Nenhuma solicitação encontrada com os filtros selecionados.
                    </td>
                  </tr>
                ) : (
                  filteredTrips.map((trip) => {
                    const departureFormatted = safeFormatDate(trip.departure_datetime, 'dd/MM/yy HH:mm', '-');
                    const returnFormatted = safeFormatDate(trip.return_datetime, 'dd/MM/yy HH:mm', '-');
                    const veh = getVehicleData(trip.allocated_vehicle_id);
                    const driver = getDriverData(trip.allocated_driver_id);
                    const isConfirmed = trip.status === 'Confirmado ao Demandante';

                    return (
                      <tr key={trip.id} className="hover:bg-slate-50/90 transition-colors group">
                        <td className="py-2.5 px-3 pl-4 font-bold text-navy-950 whitespace-nowrap font-mono sticky left-0 bg-white group-hover:bg-slate-50/90 z-10">
                          <span
                            onClick={() => onSelectTripDetail(trip)}
                            className="hover:text-brand-600 cursor-pointer underline decoration-dotted"
                          >
                            {trip.process_number}
                          </span>
                        </td>

                        <td className="py-2.5 px-2">
                          <div className="font-semibold text-slate-900 truncate max-w-[140px]" title={trip.requester_name}>
                            {trip.requester_name}
                          </div>
                          <div className="text-[10px] text-slate-500 font-medium truncate max-w-[140px]">
                            <span className="font-bold text-slate-700">{trip.macro_unit}</span> • {trip.activity_type}
                          </div>
                        </td>

                        <td className="py-2.5 px-2 whitespace-nowrap">
                          <div className="font-semibold text-slate-800">
                            {getCityName(trip.origin_city_id)} ➔ {getCityName(trip.destination_city_id)}
                          </div>
                        </td>

                        <td className="py-2.5 px-2 whitespace-nowrap">
                          <div className="text-slate-800 font-semibold">{departureFormatted}</div>
                          <div className="text-[10px] text-slate-500">Ret: {returnFormatted}</div>
                        </td>

                        <td className="py-2.5 px-2 text-center font-bold text-slate-700">
                          {trip.passenger_count}
                        </td>

                        <td className="py-2.5 px-2 text-center whitespace-nowrap font-bold text-brand-700 bg-brand-50/40">
                          {trip.estimated_km} km
                        </td>

                        <td className="py-2.5 px-2 whitespace-nowrap">
                          <StatusBadge deadline={trip.status_deadline} />
                        </td>

                        <td className="py-2.5 px-2 whitespace-nowrap">
                          <StatusBadge status={trip.status} />
                        </td>

                        <td className="py-2.5 px-2 whitespace-nowrap text-[10.5px]">
                          {isConfirmed && veh ? (
                            <div className="space-y-0.5">
                              <span className="block font-bold text-navy-900 truncate max-w-[130px]">{veh.plate}</span>
                              <span className="block text-slate-500 truncate max-w-[130px]">{driver?.name}</span>
                            </div>
                          ) : (
                            <span className="text-slate-400 italic">Pendente</span>
                          )}
                        </td>

                        <td className="py-2.5 px-3 pr-4 text-right whitespace-nowrap sticky right-0 bg-white group-hover:bg-slate-50/90 z-10 border-l border-slate-200/70">
                          <div className="flex items-center justify-end gap-1">
                            {isConfirmed && (
                              <button
                                onClick={() => {
                                  if (onOpenTrafficOrderModal) {
                                    onOpenTrafficOrderModal(trip);
                                  } else {
                                    ExportService.exportTrafficOrderPDF(trip);
                                  }
                                }}
                                title="Emitir Ordem de Tráfego (PDF)"
                                className="p-1 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 rounded-lg transition-colors"
                              >
                                <Printer className="w-3.5 h-3.5" />
                              </button>
                            )}

                            <button
                              onClick={() => onSelectTripDetail(trip)}
                              title="Ver Ficha Detalhada"
                              className="p-1 text-slate-500 hover:text-slate-900 hover:bg-slate-200/70 rounded-lg transition-colors"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={() => onOpenDispatchModal(trip)}
                              title={isConfirmed ? 'Alterar escala de motorista e veículo' : 'Escalar motorista e veículo'}
                              className={`px-2.5 py-1 rounded-lg text-[10.5px] font-bold text-white shadow-xs flex items-center gap-1 transition-all active:scale-95 whitespace-nowrap ${
                                isConfirmed
                                  ? 'bg-slate-700 hover:bg-slate-800'
                                  : 'bg-brand-600 hover:bg-brand-700'
                              }`}
                            >
                              <SendHorizontal className="w-3 h-3" />
                              <span>{isConfirmed ? 'Re-escalar' : 'Escalar Demanda'}</span>
                            </button>

                            <button
                              onClick={() => onOpenRejectModal(trip)}
                              title="Indeferir Demanda"
                              className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                            </button>

                            {onOpenDeleteModal && (
                              <button
                                onClick={() => onOpenDeleteModal(trip)}
                                title="Excluir Solicitação (Exige Senha)"
                                className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
};

