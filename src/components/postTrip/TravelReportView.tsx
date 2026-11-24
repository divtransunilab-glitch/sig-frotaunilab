import React, { useMemo, useState } from 'react';
import { TripRequest } from '../../types';
import { TripService } from '../../services/tripService';
import { DistanceService } from '../../services/distanceService';
import { FleetService } from '../../services/fleetService';
import { StatusBadge } from '../common/StatusBadge';
import {
  ClipboardCheck,
  Clock,
  CheckCircle2,
  FileCheck,
  UploadCloud,
  Milestone,
  Fuel,
  DollarSign,
  X,
  SendHorizontal,
  Smartphone,
  Check,
  Search,
  Filter,
  RotateCcw,
  Gauge,
  Pencil,
} from 'lucide-react';
import { safeFormatDate } from '../../utils/dateUtils';
import { buildDriverOrderUrl } from '../../utils/driverLinkUtils';

interface TravelReportViewProps {
  trips: TripRequest[];
  onTripUpdated: () => void;
}

type ReportFilterType =
  | 'all'
  | 'driver_submitted'
  | 'driver_in_progress'
  | 'awaiting_manager'
  | 'awaiting_contractor'
  | 'finalized';

export const TravelReportView: React.FC<TravelReportViewProps> = ({ trips, onTripUpdated }) => {
  const [selectedTrip, setSelectedTrip] = useState<TripRequest | null>(null);
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [copiedTripId, setCopiedTripId] = useState<string | null>(null);

  // Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<ReportFilterType>('all');
  const [driverFilter, setDriverFilter] = useState<string>('all');
  const [monthFilter, setMonthFilter] = useState<string>('all');

  // Form State (Lançar / Editar KM)
  const [odometerStart, setOdometerStart] = useState<string>('');
  const [odometerEnd, setOdometerEnd] = useState<string>('');
  const [realKm, setRealKm] = useState<string>('');
  const [fuelLiters, setFuelLiters] = useState<string>('');
  const [tollAmount, setTollAmount] = useState<string>('');
  const [reportNotes, setReportNotes] = useState<string>('');
  const [formError, setFormError] = useState<string>('');

  const cities = DistanceService.getCities();
  const vehicles = FleetService.getVehicles();
  const drivers = FleetService.getDrivers();

  const handleCopyDriverLink = async (tripId: string) => {
    const url = buildDriverOrderUrl(tripId);
    try {
      await navigator.clipboard.writeText(url);
      setCopiedTripId(tripId);
      setTimeout(() => setCopiedTripId((prev) => (prev === tripId ? null : prev)), 2500);
    } catch {
      window.prompt('Copie o link mobile do motorista:', url);
    }
  };

  const getCityName = (id: string) => {
    const c = cities.find((item) => item.id === id);
    return c ? c.name : id;
  };

  const getVehiclePlate = (id?: string) => {
    if (!id) return '-';
    const v = vehicles.find((item) => item.id === id);
    return v ? `${v.model} (${v.plate})` : '-';
  };

  const getDriverName = (id?: string) => {
    if (!id) return '-';
    const d = drivers.find((item) => item.id === id);
    return d ? d.name : '-';
  };

  const handleOpenSubmitModal = (trip: TripRequest) => {
    setSelectedTrip(trip);
    setOdometerStart(
      trip.odometer_start !== undefined && trip.odometer_start !== null
        ? String(trip.odometer_start)
        : ''
    );
    setOdometerEnd(
      trip.odometer_end !== undefined && trip.odometer_end !== null
        ? String(trip.odometer_end)
        : ''
    );
    setRealKm(
      trip.real_km !== undefined && trip.real_km !== null
        ? String(trip.real_km)
        : String(trip.estimated_km)
    );
    setFuelLiters(trip.fuel_liters?.toString() || '');
    setTollAmount(trip.toll_amount?.toString() || '');
    setReportNotes(trip.report_notes || '');
    setFormError('');
    setIsSubmitModalOpen(true);
  };

  const handleOdometerChange = (nextStart: string, nextEnd: string) => {
    setOdometerStart(nextStart);
    setOdometerEnd(nextEnd);
    setFormError('');

    const s = parseFloat(nextStart);
    const e = parseFloat(nextEnd);
    if (!isNaN(s) && !isNaN(e) && e >= s) {
      setRealKm(String(Number((e - s).toFixed(1))));
    }
  };

  const handleSubmitReport = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTrip) return;

    const startVal = odometerStart.trim() !== '' ? parseFloat(odometerStart) : undefined;
    const endVal = odometerEnd.trim() !== '' ? parseFloat(odometerEnd) : undefined;

    if (startVal !== undefined && endVal !== undefined && endVal < startVal) {
      setFormError('O KM Final do hodômetro não pode ser menor que o KM Inicial.');
      return;
    }

    const parsedRealKm = parseFloat(realKm);
    if (isNaN(parsedRealKm) || parsedRealKm < 0) {
      setFormError('Informe uma quilometragem real válida.');
      return;
    }

    TripService.submitTravelReport(selectedTrip.id, {
      real_km: parsedRealKm,
      odometer_start: startVal,
      odometer_end: endVal,
      fuel_liters: fuelLiters ? parseFloat(fuelLiters) : undefined,
      toll_amount: tollAmount ? parseFloat(tollAmount) : undefined,
      report_notes: reportNotes,
      preserveFinalizedStatus: selectedTrip.travel_report_status === 'Finalizado no Sistema',
    });

    setIsSubmitModalOpen(false);
    onTripUpdated();
  };

  const handleApproveReport = (tripId: string) => {
    TripService.approveTravelReport(tripId);
    onTripUpdated();
  };

  // Filtrar apenas viagens confirmadas com status de relatório
  const eligibleTrips = useMemo(
    () => trips.filter((t) => t.status === 'Confirmado ao Demandante' && t.travel_report_status),
    [trips]
  );

  // KPIs
  const driverSubmittedCount = useMemo(
    () => eligibleTrips.filter((t) => Boolean(t.driver_checkout_at)).length,
    [eligibleTrips]
  );
  const awaitingContractor = useMemo(
    () => eligibleTrips.filter((t) => t.travel_report_status === 'Aguardando Envio da Contratada'),
    [eligibleTrips]
  );
  const awaitingManager = useMemo(
    () => eligibleTrips.filter((t) => t.travel_report_status === 'Aguardando a Apreciação do Gerente'),
    [eligibleTrips]
  );
  const finalized = useMemo(
    () => eligibleTrips.filter((t) => t.travel_report_status === 'Finalizado no Sistema'),
    [eligibleTrips]
  );

  // Opções dinâmicas de meses presentes nas viagens
  const availableMonths = useMemo(() => {
    const map = new Map<string, string>();
    eligibleTrips.forEach((t) => {
      const key = safeFormatDate(t.departure_datetime, 'yyyy-MM', '');
      const label = safeFormatDate(t.departure_datetime, 'MMMM / yyyy', '');
      if (key && label) {
        map.set(key, label.charAt(0).toUpperCase() + label.slice(1));
      }
    });
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [eligibleTrips]);

  // Motoristas presentes nas viagens
  const availableDrivers = useMemo(() => {
    const ids = new Set<string>();
    eligibleTrips.forEach((t) => {
      if (t.allocated_driver_id) ids.add(t.allocated_driver_id);
    });
    return Array.from(ids)
      .map((id) => ({ id, name: getDriverName(id) }))
      .filter((d) => d.name !== '-')
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [eligibleTrips, drivers]);

  // Prioridade de ordenação: KM lançado pelo motorista SEMPRE primeiro na lista
  const getPriorityRank = (t: TripRequest): number => {
    const hasDriverCheckout = Boolean(t.driver_checkout_at);
    const hasDriverCheckinOnly = Boolean(t.driver_checkin_at) && !hasDriverCheckout;
    const isAwaitingManager = t.travel_report_status === 'Aguardando a Apreciação do Gerente';
    const isFinalized = t.travel_report_status === 'Finalizado no Sistema';

    if (hasDriverCheckout && !isFinalized) return 0; // 1º: Enviado pelo motorista aguardando homologação
    if (hasDriverCheckinOnly && !isFinalized) return 1; // 2º: Motorista em viagem (check-in ativo)
    if (hasDriverCheckout && isFinalized) return 2; // 3º: Enviado pelo motorista já homologado
    if (isAwaitingManager) return 3; // 4º: Lançado manualmente aguardando homologação
    if (!isFinalized) return 4; // 5º: Aguardando envio da contratada
    return 5; // 6º: Demais finalizados
  };

  // Aplicação de filtros + ordenação prioritária
  const filteredAndSortedTrips = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    const filtered = eligibleTrips.filter((t) => {
      if (statusFilter === 'driver_submitted' && !t.driver_checkout_at) return false;
      if (statusFilter === 'driver_in_progress' && (!t.driver_checkin_at || Boolean(t.driver_checkout_at))) {
        return false;
      }
      if (statusFilter === 'awaiting_manager' && t.travel_report_status !== 'Aguardando a Apreciação do Gerente') {
        return false;
      }
      if (statusFilter === 'awaiting_contractor' && t.travel_report_status !== 'Aguardando Envio da Contratada') {
        return false;
      }
      if (statusFilter === 'finalized' && t.travel_report_status !== 'Finalizado no Sistema') {
        return false;
      }

      if (driverFilter !== 'all' && t.allocated_driver_id !== driverFilter) return false;

      if (monthFilter !== 'all') {
        const tripMonth = safeFormatDate(t.departure_datetime, 'yyyy-MM', '');
        if (tripMonth !== monthFilter) return false;
      }

      if (term) {
        const haystack = [
          t.process_number,
          t.requester_name,
          t.macro_unit,
          getCityName(t.origin_city_id),
          getCityName(t.destination_city_id),
          getVehiclePlate(t.allocated_vehicle_id),
          getDriverName(t.allocated_driver_id),
        ]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(term)) return false;
      }

      return true;
    });

    return filtered.sort((a, b) => {
      const rankDiff = getPriorityRank(a) - getPriorityRank(b);
      if (rankDiff !== 0) return rankDiff;

      // Dentro do mesmo grupo: mais recente primeiro (por check-out/check-in ou data de retorno)
      const timeA = new Date(
        a.driver_checkout_at || a.driver_checkin_at || a.report_submitted_at || a.return_datetime
      ).getTime();
      const timeB = new Date(
        b.driver_checkout_at || b.driver_checkin_at || b.report_submitted_at || b.return_datetime
      ).getTime();
      return (isNaN(timeB) ? 0 : timeB) - (isNaN(timeA) ? 0 : timeA);
    });
  }, [eligibleTrips, statusFilter, driverFilter, monthFilter, searchTerm, cities, vehicles, drivers]);

  const hasActiveFilters =
    searchTerm.trim() !== '' || statusFilter !== 'all' || driverFilter !== 'all' || monthFilter !== 'all';

  const handleClearFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setDriverFilter('all');
    setMonthFilter('all');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-4 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5 text-brand-600" />
            <h2 className="text-xl font-extrabold text-navy-950">
              Relatórios de Viagem & Apuração de KM Real
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Fluxo de encerramento pós-viagem: lançamentos do motorista aparecem primeiro para revisão e homologação
          </p>
        </div>

        {driverSubmittedCount > 0 && (
          <button
            type="button"
            onClick={() =>
              setStatusFilter((prev) => (prev === 'driver_submitted' ? 'all' : 'driver_submitted'))
            }
            className={`px-3.5 py-2 rounded-xl text-xs font-extrabold border flex items-center gap-2 transition-all self-start md:self-auto ${
              statusFilter === 'driver_submitted'
                ? 'bg-emerald-600 text-white border-emerald-700 shadow-md'
                : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
            }`}
          >
            <Smartphone className="w-4 h-4" />
            <span>{driverSubmittedCount} KM lançado(s) pelo motorista</span>
          </button>
        )}
      </div>

      {/* KPI Status Cards (clicáveis como filtro rápido) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <button
          type="button"
          onClick={() =>
            setStatusFilter((prev) => (prev === 'awaiting_contractor' ? 'all' : 'awaiting_contractor'))
          }
          className={`text-left bg-amber-50/70 border rounded-2xl p-4 flex items-center justify-between transition-all ${
            statusFilter === 'awaiting_contractor'
              ? 'border-amber-500 ring-2 ring-amber-300'
              : 'border-amber-200 hover:border-amber-300'
          }`}
        >
          <div>
            <span className="text-xs font-bold text-amber-800 uppercase tracking-wider block">
              Aguardando Contratada
            </span>
            <span className="text-2xl font-extrabold text-amber-950 mt-1 block">
              {awaitingContractor.length}
            </span>
          </div>
          <Clock className="w-8 h-8 text-amber-500 opacity-60" />
        </button>

        <button
          type="button"
          onClick={() =>
            setStatusFilter((prev) => (prev === 'awaiting_manager' ? 'all' : 'awaiting_manager'))
          }
          className={`text-left bg-purple-50/70 border rounded-2xl p-4 flex items-center justify-between transition-all ${
            statusFilter === 'awaiting_manager'
              ? 'border-purple-500 ring-2 ring-purple-300'
              : 'border-purple-200 hover:border-purple-300'
          }`}
        >
          <div>
            <span className="text-xs font-bold text-purple-800 uppercase tracking-wider block">
              Aguardando Homologação do Gerente
            </span>
            <span className="text-2xl font-extrabold text-purple-950 mt-1 block">
              {awaitingManager.length}
            </span>
          </div>
          <FileCheck className="w-8 h-8 text-purple-500 opacity-60" />
        </button>

        <button
          type="button"
          onClick={() =>
            setStatusFilter((prev) => (prev === 'finalized' ? 'all' : 'finalized'))
          }
          className={`text-left bg-brand-50/70 border rounded-2xl p-4 flex items-center justify-between transition-all ${
            statusFilter === 'finalized'
              ? 'border-brand-600 ring-2 ring-brand-300'
              : 'border-brand-200 hover:border-brand-300'
          }`}
        >
          <div>
            <span className="text-xs font-bold text-brand-800 uppercase tracking-wider block">
              Finalizados no Sistema
            </span>
            <span className="text-2xl font-extrabold text-brand-950 mt-1 block">
              {finalized.length}
            </span>
          </div>
          <CheckCircle2 className="w-8 h-8 text-brand-600 opacity-60" />
        </button>
      </div>

      {/* Barra de Filtros */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600 uppercase tracking-wider">
            <Filter className="w-3.5 h-3.5 text-brand-600" />
            <span>Filtros de Relatório</span>
          </div>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleClearFilters}
              className="text-xs font-bold text-brand-700 hover:text-brand-800 flex items-center gap-1"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Limpar filtros</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          {/* Busca livre */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar processo, solicitante, placa, cidade..."
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:border-brand-500 focus:outline-hidden text-slate-800"
            />
          </div>

          {/* Status / Origem */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as ReportFilterType)}
            className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:border-brand-500 focus:outline-hidden text-slate-800 font-semibold"
          >
            <option value="all">Todos os status ({eligibleTrips.length})</option>
            <option value="driver_submitted">
              Enviado pelo Motorista ({driverSubmittedCount})
            </option>
            <option value="driver_in_progress">Em Viagem (Check-in ativo)</option>
            <option value="awaiting_manager">
              Aguardando Homologação ({awaitingManager.length})
            </option>
            <option value="awaiting_contractor">
              Aguardando Contratada ({awaitingContractor.length})
            </option>
            <option value="finalized">Finalizados ({finalized.length})</option>
          </select>

          {/* Motorista */}
          <select
            value={driverFilter}
            onChange={(e) => setDriverFilter(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:border-brand-500 focus:outline-hidden text-slate-800 font-semibold"
          >
            <option value="all">Todos os motoristas</option>
            {availableDrivers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>

          {/* Mês / Ano */}
          <select
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:border-brand-500 focus:outline-hidden text-slate-800 font-semibold"
          >
            <option value="all">Todos os meses</option>
            {availableMonths.map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table of Trips */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            Viagens em Ciclo de Fechamento ({filteredAndSortedTrips.length}
            {hasActiveFilters ? ` de ${eligibleTrips.length}` : ''})
          </span>
          <span className="text-[11px] text-slate-500 font-medium">
            Ordenado com lançamentos do motorista no topo
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100/70 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                <th className="p-3.5 pl-4">Nº Processo</th>
                <th className="p-3.5">Solicitante</th>
                <th className="p-3.5">Trecho</th>
                <th className="p-3.5">Retorno</th>
                <th className="p-3.5">Veículo / Motorista</th>
                <th className="p-3.5 text-center">KM Previsto</th>
                <th className="p-3.5 text-center">KM Real</th>
                <th className="p-3.5">Status Relatório</th>
                <th className="p-3.5 text-right pr-4">Ação de Encerramento</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredAndSortedTrips.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-400">
                    {hasActiveFilters
                      ? 'Nenhuma viagem encontrada com os filtros selecionados.'
                      : 'Nenhuma viagem confirmada com relatório pendente.'}
                  </td>
                </tr>
              ) : (
                filteredAndSortedTrips.map((trip) => {
                  const returnFormatted = safeFormatDate(trip.return_datetime, 'dd/MM/yy HH:mm', '-');
                  const isAwaitingManager =
                    trip.travel_report_status === 'Aguardando a Apreciação do Gerente';
                  const isFinalized = trip.travel_report_status === 'Finalizado no Sistema';
                  const hasDriverSubmission = Boolean(trip.driver_checkout_at);
                  const hasKmRecorded =
                    hasDriverSubmission ||
                    (trip.real_km !== undefined && trip.real_km !== null) ||
                    isFinalized;

                  return (
                    <tr
                      key={trip.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        hasDriverSubmission && !isFinalized ? 'bg-emerald-50/30' : ''
                      }`}
                    >
                      <td
                        className={`p-3.5 pl-4 font-bold text-navy-950 whitespace-nowrap ${
                          hasDriverSubmission && !isFinalized
                            ? 'border-l-4 border-emerald-500'
                            : trip.driver_checkin_at && !isFinalized
                            ? 'border-l-4 border-sky-400'
                            : ''
                        }`}
                      >
                        {trip.process_number}
                      </td>
                      <td className="p-3.5">
                        <div className="font-semibold text-slate-900">{trip.requester_name}</div>
                        <div className="text-[10px] text-slate-500">{trip.macro_unit}</div>
                      </td>
                      <td className="p-3.5 whitespace-nowrap">
                        {getCityName(trip.origin_city_id)} ➔ {getCityName(trip.destination_city_id)}
                      </td>
                      <td className="p-3.5 whitespace-nowrap font-medium text-slate-700">
                        {returnFormatted}
                      </td>
                      <td className="p-3.5 whitespace-nowrap">
                        <div className="font-bold text-slate-800">
                          {getVehiclePlate(trip.allocated_vehicle_id)}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {getDriverName(trip.allocated_driver_id)}
                        </div>
                      </td>
                      <td className="p-3.5 text-center font-semibold text-slate-600">
                        {trip.estimated_km} km
                      </td>
                      <td className="p-3.5 text-center font-extrabold text-brand-700 bg-brand-50/50">
                        <div>{trip.real_km ? `${trip.real_km} km` : '-'}</div>
                        {trip.odometer_start !== undefined &&
                          trip.odometer_start !== null &&
                          trip.odometer_end !== undefined &&
                          trip.odometer_end !== null && (
                            <div className="text-[10px] font-semibold text-slate-500 mt-0.5">
                              {trip.odometer_start} → {trip.odometer_end}
                            </div>
                          )}
                      </td>
                      <td className="p-3.5 whitespace-nowrap">
                        <StatusBadge reportStatus={trip.travel_report_status} />
                        {trip.driver_checkout_at ? (
                          <div className="text-[10px] font-bold text-emerald-700 mt-1 flex items-center gap-1">
                            <Smartphone className="w-3 h-3" />
                            <span>
                              Enviado pelo motorista ({safeFormatDate(trip.driver_checkout_at, 'dd/MM HH:mm', '')})
                            </span>
                          </div>
                        ) : trip.driver_checkin_at ? (
                          <div className="text-[10px] font-bold text-sky-700 mt-1 flex items-center gap-1">
                            <Smartphone className="w-3 h-3" />
                            <span>
                              Em viagem • Check-in {safeFormatDate(trip.driver_checkin_at, 'dd/MM HH:mm', '')}
                            </span>
                          </div>
                        ) : null}
                      </td>
                      <td className="p-3.5 pr-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          {/* Copiar link mobile do motorista */}
                          {!isFinalized && (
                            <button
                              onClick={() => handleCopyDriverLink(trip.id)}
                              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 transition-colors flex items-center gap-1"
                              title="Copiar link mobile para o motorista fazer check-in/out"
                            >
                              {copiedTripId === trip.id ? (
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <Smartphone className="w-3.5 h-3.5 text-teal-600" />
                              )}
                              <span>{copiedTripId === trip.id ? 'Copiado!' : 'Link Motorista'}</span>
                            </button>
                          )}

                          {/* Botão Lançar / Editar KM (permite editar KM e hodômetro lançados pelo motorista) */}
                          <button
                            onClick={() => handleOpenSubmitModal(trip)}
                            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors flex items-center gap-1"
                            title={
                              hasDriverSubmission
                                ? 'Revisar ou corrigir o KM e hodômetro lançados pelo motorista'
                                : 'Lançar ou editar a quilometragem real'
                            }
                          >
                            {hasKmRecorded ? (
                              <Pencil className="w-3.5 h-3.5 text-blue-600" />
                            ) : (
                              <UploadCloud className="w-3.5 h-3.5 text-blue-600" />
                            )}
                            <span>{hasKmRecorded ? 'Editar KM' : 'Lançar KM Real'}</span>
                          </button>

                          {/* Botão de Homologação do Gerente */}
                          {isAwaitingManager && (
                            <button
                              onClick={() => handleApproveReport(trip.id)}
                              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-brand-600 hover:bg-brand-700 text-white shadow-xs transition-all flex items-center gap-1 active:scale-95"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Homologar Parecer</span>
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
      </div>

      {/* Modal Lançamento / Edição do Relatório e KM do Motorista */}
      {isSubmitModalOpen && selectedTrip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200/80 w-full max-w-lg overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <span className="text-xs font-bold text-brand-600 uppercase tracking-wider">
                  Prestação de Contas
                </span>
                <h3 className="font-bold text-base text-navy-950">
                  {selectedTrip.real_km || selectedTrip.driver_checkout_at
                    ? `Editar KM / Relatório: ${selectedTrip.process_number}`
                    : `Lançar Relatório: ${selectedTrip.process_number}`}
                </h3>
              </div>
              <button
                onClick={() => setIsSubmitModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitReport} className="space-y-4 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-slate-700 space-y-1">
                <div>
                  Trecho:{' '}
                  <strong>
                    {getCityName(selectedTrip.origin_city_id)} ➔{' '}
                    {getCityName(selectedTrip.destination_city_id)}
                  </strong>{' '}
                  (KM Previsto: {selectedTrip.estimated_km} km)
                </div>
                {(selectedTrip.driver_checkin_at || selectedTrip.driver_checkout_at) && (
                  <div className="flex flex-wrap items-center gap-3 text-[11px] text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-2.5 py-1.5 mt-1">
                    <Smartphone className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>
                      <strong>Registro do Motorista:</strong>{' '}
                      {selectedTrip.driver_checkin_at
                        ? `Saída ${safeFormatDate(selectedTrip.driver_checkin_at, 'dd/MM HH:mm', '-')}`
                        : ''}
                      {selectedTrip.driver_checkin_at && selectedTrip.driver_checkout_at ? ' • ' : ''}
                      {selectedTrip.driver_checkout_at
                        ? `Retorno ${safeFormatDate(selectedTrip.driver_checkout_at, 'dd/MM HH:mm', '-')}`
                        : ''}
                    </span>
                  </div>
                )}
              </div>

              {formError && (
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 font-semibold">
                  {formError}
                </div>
              )}

              {/* Hodômetro Inicial e Final (editáveis — recalcula KM Real automaticamente) */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1 flex items-center gap-1">
                    <Gauge className="w-3.5 h-3.5 text-sky-600" />
                    KM Inicial (Hodômetro)
                  </label>
                  <input
                    type="number"
                    step={0.1}
                    placeholder="Ex: 48250"
                    value={odometerStart}
                    onChange={(e) => handleOdometerChange(e.target.value, odometerEnd)}
                    className="w-full rounded-xl border border-slate-300 p-2 text-slate-800 font-bold focus:border-brand-500 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1 flex items-center gap-1">
                    <Gauge className="w-3.5 h-3.5 text-emerald-600" />
                    KM Final (Hodômetro)
                  </label>
                  <input
                    type="number"
                    step={0.1}
                    placeholder="Ex: 48395"
                    value={odometerEnd}
                    onChange={(e) => handleOdometerChange(odometerStart, e.target.value)}
                    className="w-full rounded-xl border border-slate-300 p-2 text-slate-800 font-bold focus:border-brand-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-1">
                  <Milestone className="w-3.5 h-3.5 text-brand-600" />
                  Quilometragem Real Percorrida (KM Total) *
                </label>
                <input
                  type="number"
                  required
                  min={0}
                  step={0.1}
                  value={realKm}
                  onChange={(e) => setRealKm(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-sm font-bold text-slate-900 focus:border-brand-500 focus:outline-hidden"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Calculado automaticamente ao alterar o Hodômetro Inicial/Final, ou editável diretamente acima.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1 flex items-center gap-1">
                    <Fuel className="w-3.5 h-3.5 text-amber-600" />
                    Combustível (Litros)
                  </label>
                  <input
                    type="number"
                    step={0.1}
                    placeholder="Ex: 24.5"
                    value={fuelLiters}
                    onChange={(e) => setFuelLiters(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 p-2 text-slate-800 focus:border-brand-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1 flex items-center gap-1">
                    <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                    Pedágio / Taxas (R$)
                  </label>
                  <input
                    type="number"
                    step={0.01}
                    placeholder="Ex: 12.00"
                    value={tollAmount}
                    onChange={(e) => setTollAmount(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 p-2 text-slate-800 focus:border-brand-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Observações do Motorista / Ocorrências no Percurso
                </label>
                <textarea
                  rows={3}
                  placeholder="Ex: Viagem realizada sem intercorrências, chegada no horário previsto..."
                  value={reportNotes}
                  onChange={(e) => setReportNotes(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 p-2 text-slate-800 focus:border-brand-500 focus:outline-hidden"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsSubmitModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-white bg-brand-600 hover:bg-brand-700 font-bold shadow-md flex items-center gap-1.5"
                >
                  <SendHorizontal className="w-3.5 h-3.5" />
                  <span>
                    {selectedTrip.travel_report_status === 'Finalizado no Sistema'
                      ? 'Salvar Alterações de KM'
                      : 'Salvar & Enviar para Parecer'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
