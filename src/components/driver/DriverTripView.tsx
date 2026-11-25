import React, { useEffect, useMemo, useState } from 'react';
import { TripRequest, TripLeg, Vehicle, Driver, City } from '../../types';
import { TripService } from '../../services/tripService';
import { FleetService } from '../../services/fleetService';
import { DistanceService } from '../../services/distanceService';
import { safeFormatDate } from '../../utils/dateUtils';
import { parsePassengerList } from '../../utils/textUtils';
import {
  buildDefaultTripLegs,
  buildGoogleMapsUrl,
  buildWazeUrl,
  buildWhatsAppUrl,
  getDriverTokenFromUrl,
  getExpectedDriverCodes,
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
  Plus,
  Trash2,
  Lock,
  KeyRound,
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
  const [secureVehicle, setSecureVehicle] = useState<Vehicle | undefined>(undefined);
  const [secureDriver, setSecureDriver] = useState<{
    id: string;
    name: string;
    cnh_category?: string;
    driver_category?: string;
    requires_code: boolean;
    has_pin?: boolean;
    has_cnh?: boolean;
    has_phone?: boolean;
  } | null>(null);
  const [serverTokenInvalid, setServerTokenInvalid] = useState(false);
  const [isCodeVerifiedOnServer, setIsCodeVerifiedOnServer] = useState(false);
  const [cities] = useState<City[]>(() => DistanceService.getCities());
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Check-in / Check-out form state
  const [odometerStart, setOdometerStart] = useState<string>('');
  const [odometerEnd, setOdometerEnd] = useState<string>('');
  const [manualRealKm, setManualRealKm] = useState<string>('');
  const [tripLegs, setTripLegs] = useState<TripLeg[]>([]);
  const [fuelLiters, setFuelLiters] = useState<string>('');
  const [tollAmount, setTollAmount] = useState<string>('');
  const [checkinNotes, setCheckinNotes] = useState<string>('');
  const [checkoutNotes, setCheckoutNotes] = useState<string>('');

  // Passenger boarding checklist (local persistence per trip)
  const [boardedPassengers, setBoardedPassengers] = useState<Record<string, boolean>>({});

  // Autenticação do Motorista (Token da URL + PIN / 4 últimos dígitos da CNH ou Telefone)
  const urlAccessToken = useMemo(() => getDriverTokenFromUrl(), []);
  const [driverCodeInput, setDriverCodeInput] = useState<string>('');
  const [verifiedDriverCode, setVerifiedDriverCode] = useState<string>(() => {
    try {
      return sessionStorage.getItem(`sigfrota_driver_code_${tripId}`) || '';
    } catch {
      return '';
    }
  });
  const [verifyError, setVerifyError] = useState<string>('');

  // Feedback banner
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'warning' | 'error';
    message: string;
  } | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    setServerTokenInvalid(false);
    try {
      const secureOrder = await TripService.fetchDriverOrderSecure(tripId, urlAccessToken);

      if (secureOrder.status === 'invalid_token') {
        setServerTokenInvalid(true);
        setTrip(null);
        return;
      }

      if (!secureOrder.usedSecureRpc) {
        const [fetchedVehicles, fetchedDrivers] = await Promise.all([
          FleetService.fetchVehiclesFromSupabase(),
          FleetService.fetchDriversFromSupabase(),
        ]);
        if (fetchedVehicles) setVehicles(fetchedVehicles);
        if (fetchedDrivers) setDrivers(fetchedDrivers);
      } else {
        if (secureOrder.vehicle) setSecureVehicle(secureOrder.vehicle);
        if (secureOrder.driver) setSecureDriver(secureOrder.driver);
      }

      const fetchedTrip = secureOrder.trip || null;
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
        // Preserva a observação registrada na saída separada da observação final (retorno)
        const existingNote = (fetchedTrip.report_notes || '').trim();
        if (fetchedTrip.driver_checkin_at && !fetchedTrip.driver_checkout_at) {
          setCheckinNotes(existingNote);
          setCheckoutNotes('');
        } else {
          setCheckinNotes(existingNote);
          setCheckoutNotes('');
        }
        setTripLegs(buildDefaultTripLegs(fetchedTrip, cities));
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
    () =>
      secureVehicle ||
      (trip?.allocated_vehicle_id ? vehicles.find((v) => v.id === trip.allocated_vehicle_id) : undefined),
    [secureVehicle, trip, vehicles]
  );

  const driver = useMemo(
    () =>
      secureDriver
        ? ({
            id: secureDriver.id,
            name: secureDriver.name,
            cnh_category: secureDriver.cnh_category || '',
            driver_category: (secureDriver.driver_category as any) || 'Motoristas de 01-09',
            contractor_id: '',
            is_active: true,
          } as Driver)
        : trip?.allocated_driver_id
        ? drivers.find((d) => d.id === trip.allocated_driver_id)
        : undefined,
    [secureDriver, trip, drivers]
  );

  const expectedDriverAuth = useMemo(() => {
    if (secureDriver) {
      const hints: string[] = [];
      if (secureDriver.has_pin) hints.push('PIN');
      if (secureDriver.has_cnh) hints.push('4 últimos dígitos da CNH');
      if (secureDriver.has_phone) hints.push('4 últimos dígitos do telefone');
      return {
        codes: [] as string[],
        hint: hints.length > 0 ? hints.join(' ou ') : '4 dígitos de identificação',
      };
    }
    return getExpectedDriverCodes(driver);
  }, [secureDriver, driver]);

  const requiresDriverCode = secureDriver
    ? secureDriver.requires_code
    : expectedDriverAuth.codes.length > 0;

  const isDriverVerified =
    !requiresDriverCode ||
    isCodeVerifiedOnServer ||
    (!secureDriver && verifiedDriverCode.length >= 4 && expectedDriverAuth.codes.includes(verifiedDriverCode));

  const isTokenInvalid =
    serverTokenInvalid ||
    Boolean(
      trip?.driver_access_token &&
        trip.driver_access_token.trim() !== '' &&
        urlAccessToken !== trip.driver_access_token.trim()
    );

  const handleVerifyDriverIdentity = async (e: React.FormEvent) => {
    e.preventDefault();
    setVerifyError('');
    const clean = driverCodeInput.replace(/\D/g, '');
    if (clean.length < 4) {
      setVerifyError('Digite os 4 dígitos de identificação.');
      return;
    }

    // Tenta validação 100% no servidor primeiro (PIN/CNH nunca sai do banco)
    const serverCheck = await TripService.verifyDriverCodeServer(tripId, urlAccessToken, clean);
    if (serverCheck.usedSecureRpc) {
      if (!serverCheck.valid) {
        setVerifyError(
          serverCheck.error ||
            `Código incorreto para o motorista escalado (${driver?.name || ''}). Informe seu ${expectedDriverAuth.hint}.`
        );
        return;
      }
      setVerifiedDriverCode(clean);
      setIsCodeVerifiedOnServer(true);
      try {
        sessionStorage.setItem(`sigfrota_driver_code_${tripId}`, clean);
      } catch {
        // ignore
      }
      return;
    }

    // Fallback local (antes da migração SQL)
    if (expectedDriverAuth.codes.length > 0 && !expectedDriverAuth.codes.includes(clean)) {
      setVerifyError(
        `Código incorreto para o motorista escalado (${driver?.name || ''}). Informe seu ${expectedDriverAuth.hint}.`
      );
      return;
    }
    setVerifiedDriverCode(clean);
    setIsCodeVerifiedOnServer(true);
    try {
      sessionStorage.setItem(`sigfrota_driver_code_${tripId}`, clean);
    } catch {
      // ignore
    }
  };

  const parsedPassengers: string[] = useMemo(() => {
    if (!trip) return [];
    return parsePassengerList(trip.passenger_names, trip.passenger_list);
  }, [trip]);

  const handleToggleAllPassengers = () => {
    if (parsedPassengers.length === 0) return;
    const allChecked = parsedPassengers.every((p) => boardedPassengers[p]);
    const next: Record<string, boolean> = {};
    parsedPassengers.forEach((p) => {
      next[p] = !allChecked;
    });
    setBoardedPassengers(next);
    try {
      localStorage.setItem(`sigfrota_boarding_${tripId}`, JSON.stringify(next));
    } catch {
      // ignore
    }
  };

  const boardedCount = useMemo(
    () => parsedPassengers.filter((p) => boardedPassengers[p]).length,
    [parsedPassengers, boardedPassengers]
  );

  // Atualiza um trecho e encadeia automaticamente o hodômetro de saída do próximo trecho
  const updateLeg = (index: number, patch: Partial<TripLeg>) => {
    setTripLegs((prev) => {
      const next = prev.map((leg, i) => (i === index ? { ...leg, ...patch } : leg));
      const updatedLeg = next[index];

      if (
        updatedLeg.odometer_start !== undefined &&
        updatedLeg.odometer_end !== undefined &&
        updatedLeg.odometer_end >= updatedLeg.odometer_start
      ) {
        updatedLeg.distance_km = Number((updatedLeg.odometer_end - updatedLeg.odometer_start).toFixed(1));
      }

      // Mantém o KM de saída do próximo trecho sempre sincronizado com o KM de chegada deste trecho
      if ('odometer_end' in patch && index + 1 < next.length) {
        const nextLeg = next[index + 1];
        const syncedStart = patch.odometer_end;
        next[index + 1] = {
          ...nextLeg,
          odometer_start: syncedStart,
          distance_km:
            syncedStart !== undefined &&
            nextLeg.odometer_end !== undefined &&
            nextLeg.odometer_end >= syncedStart
              ? Number((nextLeg.odometer_end - syncedStart).toFixed(1))
              : undefined,
        };
      }

      return next;
    });
  };

  const handleAddExtraLeg = () => {
    setTripLegs((prev) => {
      const last = prev[prev.length - 1];
      return [
        ...prev,
        {
          id: `leg-${Date.now()}`,
          origin: last?.destination || '',
          destination: '',
          odometer_start: last?.odometer_end,
        },
      ];
    });
  };

  const handleRemoveLeg = (index: number) => {
    setTripLegs((prev) => prev.filter((_, i) => i !== index));
  };

  const calculatedKm = useMemo(() => {
    // Prioridade 1: soma dos trechos preenchidos
    const legTotal = tripLegs.reduce((acc, leg) => {
      if (
        leg.odometer_start !== undefined &&
        leg.odometer_end !== undefined &&
        leg.odometer_end >= leg.odometer_start
      ) {
        return acc + (leg.odometer_end - leg.odometer_start);
      }
      if (leg.distance_km !== undefined && leg.distance_km > 0) {
        return acc + leg.distance_km;
      }
      return acc;
    }, 0);

    if (legTotal > 0) {
      return Number(legTotal.toFixed(1));
    }

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
  }, [tripLegs, odometerStart, odometerEnd, manualRealKm]);

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

    const nowIso = new Date().toISOString();
    const initialLegs = (tripLegs.length > 0 ? tripLegs : buildDefaultTripLegs(trip, cities)).map(
      (leg, idx) =>
        idx === 0
          ? { ...leg, odometer_start: startVal, started_at: nowIso }
          : leg
    );

    const formattedCheckinNote = checkinNotes.trim()
      ? checkinNotes.trim().startsWith('[Saída]')
        ? checkinNotes.trim()
        : `[Saída] ${checkinNotes.trim()}`
      : undefined;

    setIsSubmitting(true);
    const res = await TripService.submitDriverCheckIn(trip.id, {
      odometer_start: startVal,
      checkin_at: nowIso,
      notes: formattedCheckinNote,
      trip_legs: initialLegs,
      access_token: urlAccessToken || undefined,
      driver_code: verifiedDriverCode || undefined,
      verified_name: driver?.name,
    });
    setIsSubmitting(false);

    if (res.trip) {
      setTrip(res.trip);
      setTripLegs(initialLegs);
      if (formattedCheckinNote) setCheckinNotes(formattedCheckinNote);
      setCheckoutNotes('');
      setFeedback({
        type: res.syncedToCloud ? 'success' : 'warning',
        message: res.syncedToCloud
          ? 'Check-in de saída registrado! Preencha o KM de cada trecho ao longo da viagem.'
          : res.warning || 'Check-in salvo localmente.',
      });
    } else {
      setFeedback({
        type: 'error',
        message: res.warning || 'Não foi possível registrar o check-in.',
      });
    }
  };

  /**
   * Salva os trechos preenchidos em andamento (ex.: quando o motorista informa o KM de saída do retorno),
   * atualizando o status no Quadro de Saídas da DIVTRANS para "Retornando".
   */
  const handleSaveReturnProgress = async () => {
    if (!trip) return;
    setFeedback(null);

    const hasReturnStart =
      (tripLegs[0]?.odometer_end !== undefined && tripLegs[0].odometer_end > 0) ||
      tripLegs.some(
        (leg, idx) => idx > 0 && typeof leg.odometer_start === 'number' && leg.odometer_start > 0
      );
    if (!hasReturnStart) {
      setFeedback({
        type: 'error',
        message: 'Preencha o KM de Chegada no Trecho 1 (ou KM de Saída no Trecho 2) antes de salvar.',
      });
      return;
    }

    const nowIso = new Date().toISOString();
    const firstArrivalKm = tripLegs[0]?.odometer_end;
    const updatedLegs = tripLegs.map((leg, idx) => {
      if (idx === 0 && firstArrivalKm !== undefined) {
        const dist =
          leg.odometer_start !== undefined && firstArrivalKm >= leg.odometer_start
            ? Number((firstArrivalKm - leg.odometer_start).toFixed(1))
            : leg.distance_km;
        return { ...leg, distance_km: dist, finished_at: leg.finished_at || nowIso };
      }
      if (idx > 0) {
        const startKm = idx === 1 && firstArrivalKm !== undefined ? firstArrivalKm : leg.odometer_start;
        if (typeof startKm === 'number' && startKm > 0) {
          return { ...leg, odometer_start: startKm, started_at: leg.started_at || nowIso };
        }
      }
      return leg;
    });

    const baseStart =
      trip.odometer_start ||
      updatedLegs[0]?.odometer_start ||
      parseFloat(odometerStart) ||
      0;

    setIsSubmitting(true);
    const res = await TripService.submitDriverCheckIn(trip.id, {
      odometer_start: baseStart,
      checkin_at: trip.driver_checkin_at || nowIso,
      notes: (checkinNotes || trip.report_notes || '').trim() || undefined,
      trip_legs: updatedLegs,
      access_token: urlAccessToken || undefined,
      driver_code: verifiedDriverCode || undefined,
      verified_name: driver?.name,
    });
    setIsSubmitting(false);

    if (res.trip) {
      setTrip(res.trip);
      setTripLegs(updatedLegs);
      setFeedback({
        type: res.syncedToCloud ? 'success' : 'warning',
        message: res.syncedToCloud
          ? 'Início do retorno registrado! O painel da DIVTRANS foi atualizado para "Retornando".'
          : res.warning || 'Progresso salvo localmente.',
      });
    } else {
      setFeedback({
        type: 'error',
        message: res.warning || 'Não foi possível registrar o início do retorno.',
      });
    }
  };

  const handleCheckOut = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trip) return;
    setFeedback(null);

    // Validação por trecho
    for (let i = 0; i < tripLegs.length; i++) {
      const leg = tripLegs[i];
      if (
        leg.odometer_start !== undefined &&
        leg.odometer_end !== undefined &&
        leg.odometer_end < leg.odometer_start
      ) {
        setFeedback({
          type: 'error',
          message: `No Trecho ${i + 1} (${leg.origin} ➔ ${leg.destination}), o KM de chegada não pode ser menor que o KM de saída.`,
        });
        return;
      }
    }

    const finalizedLegs: TripLeg[] = tripLegs.map((leg) => {
      let dist = leg.distance_km;
      if (
        leg.odometer_start !== undefined &&
        leg.odometer_end !== undefined &&
        leg.odometer_end >= leg.odometer_start
      ) {
        dist = Number((leg.odometer_end - leg.odometer_start).toFixed(1));
      }
      return {
        ...leg,
        distance_km: dist,
        finished_at: leg.finished_at || new Date().toISOString(),
      };
    });

    const firstOdoStart =
      finalizedLegs.find((l) => l.odometer_start !== undefined)?.odometer_start ??
      (odometerStart ? parseFloat(odometerStart) : undefined);

    const lastOdoEnd =
      [...finalizedLegs].reverse().find((l) => l.odometer_end !== undefined)?.odometer_end ??
      (odometerEnd ? parseFloat(odometerEnd) : undefined);

    const finalRealKm = calculatedKm;
    if (finalRealKm === null || finalRealKm <= 0) {
      setFeedback({
        type: 'error',
        message:
          'Preencha o KM de saída e chegada (ou KM percorrido) em cada trecho para finalizar a viagem.',
      });
      return;
    }

    // Combina a observação da saída (se existir) + a observação final / intercorrência do retorno
    const departureNoteRaw = (checkinNotes || trip.report_notes || '').trim();
    const departureNoteFormatted = departureNoteRaw
      ? departureNoteRaw.startsWith('[Saída]')
        ? departureNoteRaw
        : `[Saída] ${departureNoteRaw}`
      : '';
    const returnNoteRaw = checkoutNotes.trim();
    const returnNoteFormatted = returnNoteRaw
      ? returnNoteRaw.startsWith('[Retorno]')
        ? returnNoteRaw
        : `[Retorno] ${returnNoteRaw}`
      : '';
    const combinedReportNotes = [departureNoteFormatted, returnNoteFormatted]
      .filter(Boolean)
      .join('\n') || undefined;

    setIsSubmitting(true);
    const res = await TripService.submitDriverCheckOut(trip.id, {
      odometer_start: firstOdoStart,
      odometer_end: lastOdoEnd ?? finalRealKm,
      real_km: finalRealKm,
      trip_legs: finalizedLegs,
      fuel_liters: fuelLiters ? parseFloat(fuelLiters) : undefined,
      toll_amount: tollAmount ? parseFloat(tollAmount) : undefined,
      report_notes: combinedReportNotes,
      access_token: urlAccessToken || undefined,
      driver_code: verifiedDriverCode || undefined,
      verified_name: driver?.name,
    });
    setIsSubmitting(false);

    if (res.trip) {
      setTrip(res.trip);
      setTripLegs(finalizedLegs);
      setFeedback({
        type: res.syncedToCloud ? 'success' : 'warning',
        message: res.syncedToCloud
          ? 'Check-out por trecho concluído! Relatório enviado automaticamente para homologação da DIVTRANS.'
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

  if (isTokenInvalid) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-6 text-center">
        <div className="bg-white rounded-3xl shadow-xl border border-rose-200 p-8 max-w-md w-full space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center mx-auto">
            <Lock className="w-7 h-7" />
          </div>
          <h1 className="text-lg font-extrabold text-navy-950">Link Revogado ou Inválido</h1>
          <p className="text-xs text-slate-600 leading-relaxed">
            A chave de segurança desta Ordem de Tráfego não confere ou foi revogada (por exemplo,
            após alteração do motorista escalado). Solicite o link atualizado à{' '}
            <strong>DIVTRANS / UNILAB</strong>.
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

        {/* 3. Relação de Passageiros & Conferência de Embarque */}
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Users className="w-4 h-4 text-brand-600" />
              <span>Relação de Passageiros & Embarque</span>
            </h2>
            <div className="flex items-center gap-2">
              {parsedPassengers.length > 0 && (
                <button
                  type="button"
                  onClick={handleToggleAllPassengers}
                  className="text-[11px] font-bold text-slate-600 hover:text-navy-950 underline"
                >
                  {boardedCount === parsedPassengers.length ? 'Desmarcar todos' : 'Marcar todos'}
                </button>
              )}
              <span className="text-xs font-bold text-brand-700 bg-brand-50 px-2.5 py-0.5 rounded-full border border-brand-200">
                {parsedPassengers.length > 0
                  ? `${boardedCount} / ${parsedPassengers.length} embarcados`
                  : `${trip.passenger_count} passageiro(s)`}
              </span>
            </div>
          </div>

          {parsedPassengers.length > 0 ? (
            <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto pr-1">
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
              <strong>{trip.requester_name}</strong> (lista nominal não informada no processo).
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

              {Array.isArray(trip.trip_legs) && trip.trip_legs.length > 0 && (
                <div className="bg-white rounded-xl p-3 border border-emerald-100 space-y-1.5">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">
                    Quilometragem por Trecho
                  </span>
                  {trip.trip_legs.map((leg, i) => (
                    <div
                      key={leg.id || i}
                      className="flex items-center justify-between text-xs border-b border-slate-100 last:border-b-0 pb-1 last:pb-0"
                    >
                      <span className="font-semibold text-slate-800">
                        {i + 1}. {leg.origin} ➔ {leg.destination}
                      </span>
                      <span className="font-extrabold text-emerald-700 whitespace-nowrap">
                        {leg.distance_km ?? '-'} km
                        {leg.odometer_start !== undefined && leg.odometer_end !== undefined
                          ? ` (${leg.odometer_start} → ${leg.odometer_end})`
                          : ''}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {trip.report_notes && (
                <div className="bg-white rounded-xl p-2.5 border border-emerald-100 text-xs text-slate-700 whitespace-pre-wrap">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block mb-0.5">
                    Ocorrências / Observações
                  </span>
                  {trip.report_notes}
                </div>
              )}
            </div>
          ) : !isDriverVerified ? (
            /* VERIFICAÇÃO DE IDENTIDADE DO MOTORISTA ESCALADO (OPÇÃO 1: PIN / 4 ÚLTIMOS DÍGITOS CNH OU TELEFONE) */
            <form onSubmit={handleVerifyDriverIdentity} className="space-y-3 bg-navy-950/5 border border-slate-200 rounded-2xl p-4">
              <div className="flex items-start gap-2.5">
                <div className="p-2 rounded-xl bg-navy-950 text-emerald-400 shrink-0">
                  <KeyRound className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-extrabold text-navy-950">
                    Confirme sua identidade para lançar o KM
                  </h3>
                  <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
                    Motorista escalado: <strong className="text-navy-950">{driver?.name}</strong>.
                    Digite seu <strong>{expectedDriverAuth.hint}</strong> para liberar o Check-in e o Check-out.
                  </p>
                </div>
              </div>

              {verifyError && (
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold">
                  {verifyError}
                </div>
              )}

              <div className="flex items-center gap-2">
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  required
                  value={driverCodeInput}
                  onChange={(e) => {
                    setDriverCodeInput(e.target.value.replace(/\D/g, '').slice(0, 6));
                    setVerifyError('');
                  }}
                  placeholder="4 dígitos"
                  className="flex-1 px-4 py-3 text-center text-lg font-mono font-extrabold tracking-widest rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-brand-500"
                />
                <button
                  type="submit"
                  className="px-5 py-3 rounded-xl bg-navy-950 hover:bg-navy-900 text-white text-xs font-extrabold shadow-md transition-colors"
                >
                  Confirmar
                </button>
              </div>
            </form>
          ) : !isCheckedIn ? (
            /* ETAPA 1: CHECK-IN DE SAÍDA */
            <form onSubmit={handleCheckIn} className="space-y-3">
              <div className="bg-sky-50 border border-sky-200 rounded-xl p-3 text-xs text-sky-900">
                <strong>Etapa 1 de 2 — Saída:</strong> Antes de partir ({tripLegs[0]?.origin || getCityFullName(trip.origin_city_id)} ➔ {tripLegs[0]?.destination || getCityFullName(trip.destination_city_id)}), informe o KM Inicial do hodômetro.
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
                  value={checkinNotes}
                  onChange={(e) => setCheckinNotes(e.target.value)}
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
            /* ETAPA 2: DIÁRIO DE BORDO POR TRECHO + CHECK-OUT FINAL */
            <form onSubmit={handleCheckOut} className="space-y-4">
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-900">
                <strong>Etapa 2 de 2 — KM por Trecho & Encerramento:</strong> Informe o hodômetro de saída e chegada (ou o KM rodado) em cada trecho da viagem.
              </div>

              {/* Cards de cada trecho (ex.: Redenção -> Fortaleza, Fortaleza -> Redenção) */}
              <div className="space-y-3">
                {tripLegs.map((leg, idx) => {
                  const isLastLeg = idx === tripLegs.length - 1;
                  const legDist =
                    leg.odometer_start !== undefined &&
                    leg.odometer_end !== undefined &&
                    leg.odometer_end >= leg.odometer_start
                      ? Number((leg.odometer_end - leg.odometer_start).toFixed(1))
                      : leg.distance_km;

                  return (
                    <div
                      key={leg.id || idx}
                      className={`rounded-2xl border p-3.5 space-y-2.5 ${
                        isLastLeg
                          ? 'bg-emerald-50/40 border-emerald-300'
                          : 'bg-slate-50/80 border-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="w-5 h-5 rounded-full bg-navy-950 text-white text-[10px] font-extrabold flex items-center justify-center shrink-0">
                            {idx + 1}
                          </span>
                          <span className="text-xs font-extrabold text-navy-950 truncate">
                            {leg.origin || 'Origem'} ➔ {leg.destination || 'Destino'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {legDist !== undefined && legDist >= 0 && (
                            <span className="text-[11px] font-extrabold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                              {legDist} km
                            </span>
                          )}
                          {tripLegs.length > 1 && idx >= 2 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveLeg(idx)}
                              className="p-1 text-slate-400 hover:text-rose-600"
                              title="Remover trecho extra"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Permite editar origem/destino em trechos extras */}
                      {idx >= 2 && (
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="text"
                            placeholder="Origem do trecho"
                            value={leg.origin}
                            onChange={(e) => updateLeg(idx, { origin: e.target.value })}
                            className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white"
                          />
                          <input
                            type="text"
                            placeholder="Destino do trecho"
                            value={leg.destination}
                            onChange={(e) => updateLeg(idx, { destination: e.target.value })}
                            className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white"
                          />
                        </div>
                      )}

                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 mb-0.5">
                            KM Saída
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            inputMode="decimal"
                            value={leg.odometer_start ?? ''}
                            onChange={(e) =>
                              updateLeg(idx, {
                                odometer_start: e.target.value !== '' ? parseFloat(e.target.value) : undefined,
                              })
                            }
                            placeholder="Hodômetro"
                            className="w-full px-2.5 py-2 text-xs font-extrabold rounded-xl border border-slate-300 bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-700 mb-0.5">
                            {isLastLeg ? 'KM Final *' : 'KM Chegada *'}
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            inputMode="decimal"
                            value={leg.odometer_end ?? ''}
                            onChange={(e) =>
                              updateLeg(idx, {
                                odometer_end: e.target.value !== '' ? parseFloat(e.target.value) : undefined,
                              })
                            }
                            placeholder="Hodômetro"
                            className="w-full px-2.5 py-2 text-xs font-extrabold rounded-xl border-2 border-brand-400 bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-emerald-700 mb-0.5">
                            KM Trecho
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            inputMode="decimal"
                            value={legDist ?? ''}
                            onChange={(e) =>
                              updateLeg(idx, {
                                distance_km: e.target.value !== '' ? parseFloat(e.target.value) : undefined,
                              })
                            }
                            placeholder="Auto"
                            className="w-full px-2.5 py-2 text-xs font-extrabold rounded-xl border border-emerald-300 bg-emerald-50/50 text-emerald-900"
                          />
                        </div>
                      </div>

                      {/* Botão Salvar imediato no Trecho 1 (Ida) — atualiza o painel da DIVTRANS para "Retornando" */}
                      {idx === 0 && (
                        <div className="pt-2.5 border-t border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          {tripLegs.some((l, i) => i > 0 && Boolean(l.started_at)) ? (
                            <span className="inline-flex items-center gap-1.5 text-[11px] font-extrabold text-violet-800 bg-violet-100 border border-violet-200 px-2.5 py-1 rounded-xl">
                              <CheckCircle2 className="w-3.5 h-3.5 text-violet-600 shrink-0" />
                              <span>Salvo • Painel atualizado para &ldquo;Retornando&rdquo;</span>
                            </span>
                          ) : (
                            <span className="text-[11px] text-slate-500 font-medium">
                              Preencha o <strong>KM Chegada</strong> acima e salve para mudar o status para <strong>Retornando</strong>.
                            </span>
                          )}

                          <button
                            type="button"
                            disabled={isSubmitting || leg.odometer_end === undefined}
                            onClick={handleSaveReturnProgress}
                            className="px-3.5 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-extrabold shadow-xs flex items-center justify-center gap-1.5 shrink-0 transition-colors"
                          >
                            {isSubmitting ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Navigation className="w-3.5 h-3.5" />
                            )}
                            <span>
                              {tripLegs.some((l, i) => i > 0 && Boolean(l.started_at))
                                ? 'Atualizar KM / Retorno'
                                : 'Salvar Chegada & Avisar Retorno'}
                            </span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}

                <button
                  type="button"
                  onClick={handleAddExtraLeg}
                  className="w-full py-2 px-3 rounded-xl border border-dashed border-slate-300 text-xs font-bold text-slate-600 hover:bg-slate-50 hover:border-brand-400 flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Adicionar trecho extra (deslocamento local / parada)</span>
                </button>
              </div>

              {/* Cálculo automático de KM Total Percorrido */}
              <div className="bg-navy-950 text-white rounded-xl p-3.5 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    KM Total Percorrido ({tripLegs.length} trecho{tripLegs.length > 1 ? 's' : ''})
                  </span>
                  <span className="text-lg font-extrabold text-emerald-400">
                    {calculatedKm !== null ? `${calculatedKm} km` : 'Preencha os trechos'}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">Estimado</span>
                  <span className="text-xs font-bold text-slate-200">{trip.estimated_km} km</span>
                </div>
              </div>

              {/* Observação / Intercorrência no KM Final (preserva também a observação registrada na saída) */}
              <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-3 space-y-2">
                {checkinNotes.trim() && (
                  <div className="bg-white/90 border border-amber-200 rounded-xl px-3 py-2 text-[11px] text-slate-700">
                    <span className="font-extrabold text-sky-800 block text-[10px] uppercase">
                      Observação registrada na saída (será mantida no relatório):
                    </span>
                    <span className="whitespace-pre-wrap">{checkinNotes.replace(/^\[Saída\]\s*/i, '')}</span>
                  </div>
                )}
                <label className="flex items-center gap-1.5 text-xs font-extrabold text-amber-950">
                  <FileText className="w-4 h-4 text-amber-600" />
                  <span>Observações / Intercorrências no Retorno (KM Final)</span>
                </label>
                <textarea
                  rows={3}
                  value={checkoutNotes}
                  onChange={(e) => setCheckoutNotes(e.target.value)}
                  placeholder="Informe se houve alguma intercorrência, atraso, desvio de rota, espera, problema mecânico ou observação importante..."
                  className="w-full px-3 py-2.5 text-xs rounded-xl border border-amber-300 bg-white focus:ring-2 focus:ring-amber-400 resize-none"
                />
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
