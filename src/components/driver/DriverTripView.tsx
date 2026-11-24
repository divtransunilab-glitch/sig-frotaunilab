import React, { useEffect, useMemo, useState } from 'react';
import { TripRequest, Vehicle, Driver, City } from '../../types';
import { TripService } from '../../services/tripService';
import { FleetService } from '../../services/fleetService';
import { DistanceService } from '../../services/distanceService';
import { safeFormatDate } from '../../utils/dateUtils';
import {
  buildGoogleMapsUrl,
  buildWazeUrl,
  buildWhatsAppUrl,
} from '../../utils/driverLinkUtils';
import {
  Truck,
  MapPin,
  Navigation,
  Phone,
  MessageCircle,
  Users,
  CheckCircle2,
  Clock,
  PlayCircle,
  Flag,
  Gauge,
  Fuel,
  DollarSign,
  FileText,
  AlertTriangle,
  Loader2,
  ArrowLeft,
  CheckSquare,
  Square,
  Milestone,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';

interface DriverTripViewProps {
  tripId: string;
  onExitDriverMode?: () => void;
}

export const DriverTripView: React.FC<DriverTripViewProps> = ({
  tripId,
  onExitDriverMode,
}) => {
  const [trip, setTrip] = useState<TripRequest | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>(() => FleetService.getVehicles());
  const [drivers, setDrivers] = useState<Driver[]>(() => FleetService.getDrivers());
  const [cities] = useState<City[]>(() => DistanceService.getCities());
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Check-in / Check-out form state
  const [odometerStart, setOdometerStart] = useState<string>('');
  const [odometerEnd, setOdometerEnd] = useState<string>('');
  const [manualRealKm, setManualRealKm] = useState<string>('');
  const [fuelLiters, setFuelLiters] = useState<string>('');
  const [tollAmount, setTollAmount] = useState<string>('');
  const [reportNotes, setReportNotes] = useState<string>('');

  // Passenger boarding checklist (local persistence per trip)
  const [boardedPassengers, setBoardedPassengers] = useState<Record<string, boolean>>({});

  // Feedback banner
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'warning' | 'error';
    message: string;
  } | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [fetchedTrip, fetchedVehicles, fetchedDrivers] = await Promise.all([
        TripService.fetchTripByIdPublic(tripId),
        FleetService.fetchVehiclesFromSupabase(),
        FleetService.fetchDriversFromSupabase(),
      ]);

      if (fetchedVehicles) setVehicles(fetchedVehicles);
      if (fetchedDrivers) setDrivers(fetchedDrivers);

      if (fetchedTrip) {
        setTrip(fetchedTrip);
        setOdometerStart(
          fetchedTrip.odometer_start !== undefined && fetchedTrip.odometer_start !== null
            ? String(fetchedTrip.odometer_start)
            : ''
        );
        setOdometerEnd(
          fetchedTrip.odometer_end !== undefined && fetchedTrip.odometer_end !== null
            ? String(fetchedTrip.odometer_end)
            : ''
        );
        setManualRealKm(
          fetchedTrip.real_km !== undefined && fetchedTrip.real_km !== null
            ? String(fetchedTrip.real_km)
            : ''
        );
        setFuelLiters(
          fetchedTrip.fuel_liters !== undefined && fetchedTrip.fuel_liters !== null
            ? String(fetchedTrip.fuel_liters)
            : ''
        );
        setTollAmount(
          fetchedTrip.toll_amount !== undefined && fetchedTrip.toll_amount !== null
            ? String(fetchedTrip.toll_amount)
            : ''
        );
        setReportNotes(fetchedTrip.report_notes || '');
      } else {
        setTrip(null);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    try {
      const savedBoarding = localStorage.getItem(`sigfrota_boarding_${tripId}`);
      if (savedBoarding) {
        setBoardedPassengers(JSON.parse(savedBoarding));
      }
    } catch {
      // ignore
    }
  }, [tripId]);

  const togglePassengerBoarded = (name: string) => {
    setBoardedPassengers((prev) => {
      const next = { ...prev, [name]: !prev[name] };
      try {
        localStorage.setItem(`sigfrota_boarding_${tripId}`, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const getCityFullName = (id: string) => {
    const c = cities.find((item) => item.id === id);
    return c ? `${c.name} - ${c.state}` : id;
  };

  const vehicle = useMemo(
    () => (trip?.allocated_vehicle_id ? vehicles.find((v) => v.id === trip.allocated_vehicle_id) : undefined),
    [trip, vehicles]
  );

  const driver = useMemo(
    () => (trip?.allocated_driver_id ? drivers.find((d) => d.id === trip.allocated_driver_id) : undefined),
    [trip, drivers]
  );

  const parsedPassengers: string[] = useMemo(() => {
    if (!trip) return [];
    if (trip.passenger_names && trip.passenger_names.trim()) {
      return trip.passenger_names
        .split(/\n|;/)
        .map((s) => s.trim())
        .filter(Boolean);
    }
    if (trip.passenger_list && trip.passenger_list.length > 0) {
      return trip.passenger_list;
    }
    return [];
  }, [trip]);

  const boardedCount = useMemo(
    () => parsedPassengers.filter((p) => boardedPassengers[p]).length,
    [parsedPassengers, boardedPassengers]
  );

  const calculatedKm = useMemo(() => {
    const start = parseFloat(odometerStart);
    const end = parseFloat(odometerEnd);
    if (!isNaN(start) && !isNaN(end) && end >= start) {
      return Number((end - start).toFixed(1));
    }
    const manual = parseFloat(manualRealKm);
    if (!isNaN(manual) && manual > 0) {
      return Number(manual.toFixed(1));
    }
    return null;
  }, [odometerStart, odometerEnd, manualRealKm]);

  const handleCheckIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trip) return;
    setFeedback(null);

    const startVal = parseFloat(odometerStart);
    if (isNaN(startVal) || startVal < 0) {
      setFeedback({
        type: 'error',
        message: 'Informe o KM Inicial válido do hodômetro antes de registrar a saída.',
      });
      return;
    }

    setIsSubmitting(true);
    const res = await TripService.submitDriverCheckIn(trip.id, {
      odometer_start: startVal,
      notes: reportNotes.trim() || undefined,
    });
    setIsSubmitting(false);

    if (res.trip) {
      setTrip(res.trip);
      setFeedback({
        type: res.syncedToCloud ? 'success' : 'warning',
        message: res.syncedToCloud
          ? 'Check-in de saída registrado e sincronizado com a DIVTRANS! Boa viagem.'
          : res.warning || 'Check-in salvo localmente.',
      });
    } else {
      setFeedback({
        type: 'error',
        message: res.warning || 'Não foi possível registrar o check-in.',
      });
    }
  };

  const handleCheckOut = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trip) return;
    setFeedback(null);

    const startVal = parseFloat(odometerStart);
    const endVal = parseFloat(odometerEnd);
    const manualVal = parseFloat(manualRealKm);

    if (!isNaN(startVal) && !isNaN(endVal) && endVal < startVal) {
      setFeedback({
        type: 'error',
        message: 'O KM Final do hodômetro não pode ser menor que o KM Inicial.',
      });
      return;
    }

    let finalRealKm = calculatedKm;
    if (finalRealKm === null) {
      if (!isNaN(manualVal) && manualVal > 0) {
        finalRealKm = manualVal;
      } else {
        setFeedback({
          type: 'error',
          message: 'Informe o KM Final do hodômetro (ou o KM total percorrido) para finalizar a viagem.',
        });
        return;
      }
    }

    setIsSubmitting(true);
    const res = await TripService.submitDriverCheckOut(trip.id, {
      odometer_start: !isNaN(startVal) ? startVal : undefined,
      odometer_end: !isNaN(endVal) ? endVal : finalRealKm,
      real_km: finalRealKm,
      fuel_liters: fuelLiters ? parseFloat(fuelLiters) : undefined,
      toll_amount: tollAmount ? parseFloat(tollAmount) : undefined,
      report_notes: reportNotes.trim() || undefined,
    });
    setIsSubmitting(false);

    if (res.trip) {
      setTrip(res.trip);
      setFeedback({
        type: res.syncedToCloud ? 'success' : 'warning',
        message: res.syncedToCloud
          ? 'Check-out concluído! Relatório enviado automaticamente para homologação da DIVTRANS.'
          : res.warning || 'Relatório salvo localmente.',
      });
    } else {
      setFeedback({
        type: 'error',
        message: res.warning || 'Não foi possível finalizar o relatório.',
      });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-6 text-center">
        <div className="bg-white rounded-3xl shadow-xl border border-slate-200 p-8 max-w-sm w-full flex flex-col items-center gap-3">
          <Loader2 className="w-10 h-10 text-brand-600 animate-spin" />
          <h1 className="text-base font-extrabold text-navy-950">Carregando Ordem de Tráfego...</h1>
          <p className="text-xs text-slate-500">
            Buscando itinerário, passageiros e dados do veículo no SIG-FROTA.
          </p>
        </div>
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-6 text-center">
        <div className="bg-white rounded-3xl shadow-xl border border-slate-200 p-8 max-w-md w-full space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-7 h-7" />
          </div>
          <h1 className="text-lg font-extrabold text-navy-950">Ordem de Tráfego não encontrada</h1>
          <p className="text-xs text-slate-600 leading-relaxed">
            O link pode estar incompleto ou a viagem foi removida/reagendada pela DIVTRANS.
            Solicite um novo link atualizado ao setor de transportes.
          </p>
          {onExitDriverMode && (
            <button
              onClick={onExitDriverMode}
              className="w-full py-3 px-4 rounded-xl bg-navy-950 text-white text-xs font-bold flex items-center justify-center gap-2 hover:bg-navy-900"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Ir para o Portal SIG-FROTA</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  const originLabel = trip.origin_address
    ? `${trip.origin_address}, ${getCityFullName(trip.origin_city_id)}`
    : getCityFullName(trip.origin_city_id);

  const destinationLabel = trip.destination_address
    ? `${trip.destination_address}, ${getCityFullName(trip.destination_city_id)}`
    : getCityFullName(trip.destination_city_id);

  const intermediateNames = (trip.intermediate_cities || []).map((c) => getCityFullName(c));

  const googleMapsUrl = buildGoogleMapsUrl(originLabel, destinationLabel, intermediateNames);
  const wazeUrl = buildWazeUrl(destinationLabel);

  const isFinalized = trip.travel_report_status === 'Finalizado no Sistema';
  const isReportSubmitted =
    trip.travel_report_status === 'Aguardando a Apreciação do Gerente' || Boolean(trip.driver_checkout_at);
  const isCheckedIn = Boolean(trip.driver_checkin_at);
  const isConfirmed = trip.status === 'Confirmado ao Demandante';

  const statusPill = isFinalized
    ? { label: 'Viagem Homologada', cls: 'bg-emerald-500 text-white' }
    : isReportSubmitted
    ? { label: 'Relatório Enviado (Em Homologação)', cls: 'bg-purple-500 text-white' }
    : isCheckedIn
    ? { label: 'Em Viagem • Check-in Ativo', cls: 'bg-sky-500 text-white' }
    : isConfirmed
    ? { label: 'Confirmada • Aguardando Saída', cls: 'bg-amber-400 text-navy-950' }
    : { label: trip.status, cls: 'bg-slate-600 text-white' };

  return (
    <div className="min-h-screen bg-slate-100 pb-12 antialiased text-slate-900">
      {/* Top Institutional Mobile Header */}
      <header className="bg-gradient-to-br from-navy-950 via-navy-900 to-slate-900 text-white px-4 pt-5 pb-6 shadow-lg">
        <div className="max-w-xl mx-auto space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-300">
                <Truck className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-300">
                  UNILAB • DIVTRANS / SIG-FROTA
                </p>
                <h1 className="text-base font-extrabold leading-tight">
                  Ordem de Tráfego Digital
                </h1>
              </div>
            </div>

            <button
              onClick={loadData}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 transition-colors"
              title="Atualizar dados da viagem"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-white/10">
            <div className="text-xs font-mono font-bold text-slate-200">
              SEI: {trip.process_number}
            </div>
            <span className={`px-2.5 py-1 rounded-full text-[11px] font-extrabold ${statusPill.cls}`}>
              {statusPill.label}
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-xl mx-auto px-4 -mt-3 space-y-4">
        {/* Feedback Alert */}
        {feedback && (
          <div
            className={`rounded-2xl p-4 text-xs font-bold border shadow-sm flex items-start gap-2.5 ${
              feedback.type === 'success'
                ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                : feedback.type === 'warning'
                ? 'bg-amber-50 border-amber-300 text-amber-900'
                : 'bg-rose-50 border-rose-300 text-rose-900'
            }`}
          >
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            )}
            <span className="leading-relaxed">{feedback.message}</span>
          </div>
        )}

        {/* 1. Itinerário & Botões GPS */}
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-brand-600" />
              <span>Itinerário & Navegação GPS</span>
            </h2>
            <span className="text-xs font-extrabold text-navy-950 bg-slate-100 px-2.5 py-1 rounded-lg flex items-center gap-1">
              <Milestone className="w-3.5 h-3.5 text-brand-600" />
              {trip.estimated_km} km est.
            </span>
          </div>

          <div className="space-y-3 text-sm">
            <div className="flex items-start gap-3">
              <div className="w-3 h-3 rounded-full bg-emerald-500 mt-1.5 ring-4 ring-emerald-100 shrink-0" />
              <div>
                <p className="text-[11px] font-bold uppercase text-slate-400">Embarque / Saída</p>
                <p className="font-extrabold text-navy-950">{getCityFullName(trip.origin_city_id)}</p>
                {trip.origin_address && (
                  <p className="text-xs text-slate-600 mt-0.5">{trip.origin_address}</p>
                )}
                <p className="text-xs font-bold text-emerald-700 mt-1 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  Previsto: {safeFormatDate(trip.departure_datetime, "dd/MM/yyyy 'às' HH:mm", '-')}
                </p>
              </div>
            </div>

            {intermediateNames.length > 0 && (
              <div className="flex items-start gap-3">
                <div className="w-3 h-3 rounded-full bg-amber-400 mt-1.5 ring-4 ring-amber-100 shrink-0" />
                <div>
                  <p className="text-[11px] font-bold uppercase text-slate-400">Paradas Intermediárias</p>
                  <p className="text-xs font-bold text-slate-800">{intermediateNames.join(' → ')}</p>
                </div>
              </div>
            )}

            <div className="flex items-start gap-3">
              <div className="w-3 h-3 rounded-full bg-blue-600 mt-1.5 ring-4 ring-blue-100 shrink-0" />
              <div>
                <p className="text-[11px] font-bold uppercase text-slate-400">Destino / Desembarque</p>
                <p className="font-extrabold text-navy-950">{getCityFullName(trip.destination_city_id)}</p>
                {trip.destination_address && (
                  <p className="text-xs text-slate-600 mt-0.5">{trip.destination_address}</p>
                )}
                <p className="text-xs font-bold text-slate-600 mt-1 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  Retorno previsto: {safeFormatDate(trip.return_datetime, "dd/MM/yyyy 'às' HH:mm", '-')}
                </p>
              </div>
            </div>
          </div>

          {/* Botões grandes de Navegação */}
          <div className="grid grid-cols-2 gap-2.5 pt-2">
            <a
              href={googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="py-3 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white text-xs font-extrabold flex items-center justify-center gap-2 shadow-md shadow-blue-600/20 transition-all"
            >
              <Navigation className="w-4 h-4" />
              <span>Google Maps</span>
            </a>
            <a
              href={wazeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="py-3 px-3 rounded-xl bg-sky-500 hover:bg-sky-600 active:scale-[0.98] text-white text-xs font-extrabold flex items-center justify-center gap-2 shadow-md shadow-sky-500/20 transition-all"
            >
              <Navigation className="w-4 h-4" />
              <span>Abrir no Waze</span>
            </a>
          </div>
        </section>

        {/* 2. Veículo & Contato do Solicitante */}
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
          <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <Truck className="w-4 h-4 text-brand-600" />
            <span>Veículo & Solicitante</span>
          </h2>

          <div className="grid grid-cols-2 gap-2.5 bg-slate-50 rounded-xl p-3 border border-slate-100">
            <div>
              <span className="text-[10px] font-bold uppercase text-slate-400 block">Veículo</span>
              <span className="text-xs font-extrabold text-navy-950">
                {vehicle ? vehicle.model : 'Veículo Oficial'}
              </span>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase text-slate-400 block">Placa</span>
              <span className="inline-block font-mono text-xs font-extrabold bg-white border border-slate-300 px-2 py-0.5 rounded text-navy-950 mt-0.5">
                {vehicle ? vehicle.plate : 'A definir'}
              </span>
            </div>
            <div className="col-span-2 pt-1 border-t border-slate-200/70">
              <span className="text-[10px] font-bold uppercase text-slate-400 block">Motorista Escalado</span>
              <span className="text-xs font-bold text-slate-800">
                {driver ? driver.name : trip.allocated_driver_id || 'Não definido'}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 pt-1">
            <div className="min-w-0">
              <span className="text-[10px] font-bold uppercase text-slate-400 block">
                Solicitante ({trip.macro_unit})
              </span>
              <p className="text-sm font-extrabold text-navy-950 truncate">{trip.requester_name}</p>
              {trip.requester_phone && (
                <p className="text-xs text-slate-500">{trip.requester_phone}</p>
              )}
            </div>

            {trip.requester_phone && (
              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={`tel:${trip.requester_phone.replace(/\D/g, '')}`}
                  className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-navy-950 border border-slate-200 transition-colors"
                  title="Ligar para o solicitante"
                >
                  <Phone className="w-4 h-4" />
                </a>
                <a
                  href={buildWhatsAppUrl(
                    trip.requester_phone,
                    `Olá ${trip.requester_name}, sou o motorista escalado pela DIVTRANS/UNILAB para a viagem do processo ${trip.process_number}.`
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2.5 rounded-xl bg-emerald-100 hover:bg-emerald-200 text-emerald-800 border border-emerald-200 transition-colors"
                  title="Enviar WhatsApp ao solicitante"
                >
                  <MessageCircle className="w-4 h-4" />
                </a>
              </div>
            )}
          </div>

          {trip.notes && (
            <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-3 text-xs text-amber-950">
              <span className="font-extrabold block text-[10px] uppercase text-amber-700 mb-0.5">
                Observações da DIVTRANS
              </span>
              {trip.notes}
            </div>
          )}
        </section>

        {/* 3. Checklist Interativo de Passageiros */}
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Users className="w-4 h-4 text-brand-600" />
              <span>Conferência de Embarque</span>
            </h2>
            <span className="text-xs font-bold text-brand-700 bg-brand-50 px-2.5 py-0.5 rounded-full border border-brand-200">
              {parsedPassengers.length > 0
                ? `${boardedCount} / ${parsedPassengers.length} embarcados`
                : `${trip.passenger_count} passageiro(s)`}
            </span>
          </div>

          {parsedPassengers.length > 0 ? (
            <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto pr-1">
              {parsedPassengers.map((name, idx) => {
                const checked = Boolean(boardedPassengers[name]);
                return (
                  <button
                    key={`${name}-${idx}`}
                    type="button"
                    onClick={() => togglePassengerBoarded(name)}
                    className={`w-full py-2.5 px-2 flex items-center gap-3 text-left rounded-lg transition-colors ${
                      checked ? 'bg-emerald-50/70 text-emerald-950' : 'hover:bg-slate-50 text-slate-800'
                    }`}
                  >
                    {checked ? (
                      <CheckSquare className="w-5 h-5 text-emerald-600 shrink-0" />
                    ) : (
                      <Square className="w-5 h-5 text-slate-300 shrink-0" />
                    )}
                    <span className={`text-xs font-semibold ${checked ? 'line-through text-emerald-700' : ''}`}>
                      {name}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-slate-500 bg-slate-50 rounded-xl p-3">
              Comitiva de <strong>{trip.passenger_count}</strong> pessoa(s) sob responsabilidade de{' '}
              <strong>{trip.requester_name}</strong>.
            </p>
          )}
        </section>

        {/* 4. Diário de Bordo Digital (Check-in & Check-out) */}
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Gauge className="w-4 h-4 text-brand-600" />
              <span>Diário de Bordo Digital</span>
            </h2>
            {isCheckedIn && (
              <span className="text-[11px] font-bold text-emerald-700 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Saída: {safeFormatDate(trip.driver_checkin_at, 'dd/MM HH:mm', '-')}
              </span>
            )}
          </div>

          {!isConfirmed ? (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-slate-600">
              O registro de bordo só fica disponível para viagens com status{' '}
              <strong>Confirmado ao Demandante</strong>.
            </div>
          ) : isFinalized || isReportSubmitted ? (
            /* Comprovante de Encerramento */
            <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-4 space-y-3">
              <div className="flex items-center gap-2 text-emerald-900">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                <span className="text-sm font-extrabold">
                  {isFinalized
                    ? 'Viagem Homologada pela DIVTRANS'
                    : 'Relatório Pós-Viagem Enviado com Sucesso'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-white rounded-xl p-2.5 border border-emerald-100">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">Check-in Saída</span>
                  <span className="font-extrabold text-navy-950">
                    {safeFormatDate(trip.driver_checkin_at, 'dd/MM/yy HH:mm', 'Registrado')}
                  </span>
                  {trip.odometer_start !== undefined && trip.odometer_start !== null && (
                    <span className="block text-[11px] text-slate-500">
                      Hodômetro: {trip.odometer_start} km
                    </span>
                  )}
                </div>
                <div className="bg-white rounded-xl p-2.5 border border-emerald-100">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">Check-out Retorno</span>
                  <span className="font-extrabold text-navy-950">
                    {safeFormatDate(trip.driver_checkout_at || trip.report_submitted_at, 'dd/MM/yy HH:mm', 'Enviado')}
                  </span>
                  {trip.odometer_end !== undefined && trip.odometer_end !== null && (
                    <span className="block text-[11px] text-slate-500">
                      Hodômetro: {trip.odometer_end} km
                    </span>
                  )}
                </div>
                <div className="bg-white rounded-xl p-2.5 border border-emerald-100">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">KM Real Percorrido</span>
                  <span className="text-sm font-extrabold text-emerald-700">{trip.real_km ?? '-'} km</span>
                </div>
                <div className="bg-white rounded-xl p-2.5 border border-emerald-100">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">Combustível / Pedágio</span>
                  <span className="font-bold text-slate-800">
                    {trip.fuel_liters ? `${trip.fuel_liters} L` : '-'} /{' '}
                    {trip.toll_amount ? `R$ ${trip.toll_amount.toFixed(2)}` : 'R$ 0,00'}
                  </span>
                </div>
              </div>

              {trip.report_notes && (
                <div className="bg-white rounded-xl p-2.5 border border-emerald-100 text-xs text-slate-700">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block mb-0.5">
                    Ocorrências / Observações
                  </span>
                  {trip.report_notes}
                </div>
              )}
            </div>
          ) : !isCheckedIn ? (
            /* ETAPA 1: CHECK-IN DE SAÍDA */
            <form onSubmit={handleCheckIn} className="space-y-3">
              <div className="bg-sky-50 border border-sky-200 rounded-xl p-3 text-xs text-sky-900">
                <strong>Etapa 1 de 2 — Saída:</strong> Antes de partir, informe a quilometragem atual do
                painel (hodômetro) para registrar o início da viagem.
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  KM Inicial (Hodômetro do Veículo) *
                </label>
                <input
                  type="number"
                  step="0.1"
                  inputMode="decimal"
                  required
                  value={odometerStart}
                  onChange={(e) => setOdometerStart(e.target.value)}
                  placeholder="Ex: 48250"
                  className="w-full px-4 py-3 text-base font-extrabold rounded-xl border border-slate-300 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 bg-slate-50"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Observação na Saída (opcional)
                </label>
                <input
                  type="text"
                  value={reportNotes}
                  onChange={(e) => setReportNotes(e.target.value)}
                  placeholder="Ex: Embarque pontual no Campus da Liberdade"
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-brand-500 bg-slate-50"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 px-4 rounded-xl bg-brand-600 hover:bg-brand-700 active:scale-[0.99] text-white text-sm font-extrabold flex items-center justify-center gap-2 shadow-lg shadow-brand-600/25 transition-all disabled:opacity-60"
              >
                {isSubmitting ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <PlayCircle className="w-5 h-5" />
                )}
                <span>Registrar Saída (Check-in)</span>
              </button>
            </form>
          ) : (
            /* ETAPA 2: CHECK-OUT DE RETORNO & RELATÓRIO PÓS-VIAGEM */
            <form onSubmit={handleCheckOut} className="space-y-3.5">
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-900 flex items-center justify-between gap-2">
                <div>
                  <strong>Etapa 2 de 2 — Retorno:</strong> Ao chegar na base, informe o KM Final para
                  enviar o relatório automaticamente.
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    KM Inicial (Saída)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    inputMode="decimal"
                    value={odometerStart}
                    onChange={(e) => setOdometerStart(e.target.value)}
                    placeholder="Ex: 48250"
                    className="w-full px-3 py-2.5 text-sm font-extrabold rounded-xl border border-slate-300 bg-slate-50"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    KM Final (Chegada) *
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    inputMode="decimal"
                    required
                    value={odometerEnd}
                    onChange={(e) => setOdometerEnd(e.target.value)}
                    placeholder="Ex: 48395"
                    className="w-full px-3 py-2.5 text-sm font-extrabold rounded-xl border-2 border-brand-400 focus:ring-2 focus:ring-brand-500 bg-white"
                  />
                </div>
              </div>

              {/* Cálculo automático de KM Percorrido */}
              <div className="bg-navy-950 text-white rounded-xl p-3.5 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    KM Total Percorrido
                  </span>
                  <span className="text-lg font-extrabold text-emerald-400">
                    {calculatedKm !== null ? `${calculatedKm} km` : 'Aguardando KM Final'}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">Estimado</span>
                  <span className="text-xs font-bold text-slate-200">{trip.estimated_km} km</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="flex items-center gap-1 text-[11px] font-bold text-slate-600 mb-1">
                    <Fuel className="w-3.5 h-3.5 text-amber-600" />
                    <span>Abastecimento (L)</span>
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    inputMode="decimal"
                    value={fuelLiters}
                    onChange={(e) => setFuelLiters(e.target.value)}
                    placeholder="Opcional"
                    className="w-full px-3 py-2.5 text-xs font-bold rounded-xl border border-slate-300 bg-slate-50"
                  />
                </div>
                <div>
                  <label className="flex items-center gap-1 text-[11px] font-bold text-slate-600 mb-1">
                    <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Pedágio (R$)</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    inputMode="decimal"
                    value={tollAmount}
                    onChange={(e) => setTollAmount(e.target.value)}
                    placeholder="0,00"
                    className="w-full px-3 py-2.5 text-xs font-bold rounded-xl border border-slate-300 bg-slate-50"
                  />
                </div>
              </div>

              <div>
                <label className="flex items-center gap-1 text-[11px] font-bold text-slate-600 mb-1">
                  <FileText className="w-3.5 h-3.5 text-slate-500" />
                  <span>Ocorrências / Observações de Rota</span>
                </label>
                <textarea
                  rows={3}
                  value={reportNotes}
                  onChange={(e) => setReportNotes(e.target.value)}
                  placeholder="Desvios, paradas adicionais, condições do veículo ou observações..."
                  className="w-full px-3 py-2.5 text-xs rounded-xl border border-slate-300 bg-slate-50 resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white text-sm font-extrabold flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/25 transition-all disabled:opacity-60"
              >
                {isSubmitting ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Flag className="w-5 h-5" />
                )}
                <span>Finalizar Viagem & Enviar Relatório</span>
              </button>
            </form>
          )}
        </section>

        {/* Footer */}
        <footer className="text-center pt-2 space-y-2">
          <p className="text-[11px] text-slate-400">
            SIG-FROTA UNILAB • Divisão de Transportes (DIVTRANS / PROADI)
          </p>
          {onExitDriverMode && (
            <button
              onClick={onExitDriverMode}
              className="text-xs font-bold text-slate-500 hover:text-navy-950 underline"
            >
              Acessar Portal Principal SIG-FROTA
            </button>
          )}
        </footer>
      </main>
    </div>
  );
};
