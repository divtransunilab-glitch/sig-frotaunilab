import React, { useEffect, useMemo, useState } from 'react';
import {
  Clock,
  RefreshCw,
  Maximize2,
  Minimize2,
  Truck,
  User,
  Users,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  Radio,
  QrCode,
  Eye,
  SendHorizontal,
  Calendar,
  CornerDownLeft,
  Gauge,
  Navigation,
} from 'lucide-react';
import { format, isToday, isTomorrow, parseISO, isValid, differenceInMinutes } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { TripRequest, Vehicle, Driver, City } from '../../types';
import { safeFormatDate } from '../../utils/dateUtils';

interface DailyDispatchBoardProps {
  trips: TripRequest[];
  vehicles: Vehicle[];
  drivers: Driver[];
  cities: City[];
  onRefreshData: () => void;
  onSelectTripDetail: (trip: TripRequest) => void;
  onOpenDispatchModal: (trip: TripRequest) => void;
  onOpenTrafficOrderModal: (trip: TripRequest) => void;
}

type BoardScope = 'today' | 'tomorrow' | 'both';

type LiveStatus =
  | 'in_progress'
  | 'returning'
  | 'imminent'
  | 'scheduled'
  | 'finished'
  | 'pending_dispatch';

export const DailyDispatchBoard: React.FC<DailyDispatchBoardProps> = ({
  trips,
  vehicles,
  drivers,
  cities,
  onRefreshData,
  onSelectTripDetail,
  onOpenDispatchModal,
  onOpenTrafficOrderModal,
}) => {
  const [now, setNow] = useState<Date>(() => new Date());
  const [scope, setScope] = useState<BoardScope>('both');
  const [onlyActiveOnRoad, setOnlyActiveOnRoad] = useState(false);
  const [isTvMode, setIsTvMode] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [secondsToRefresh, setSecondsToRefresh] = useState(60);

  // Relógio ao vivo + auto-refresh a cada 60 segundos (captura Check-in / Trechos / Check-out do motorista)
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
      setSecondsToRefresh((prev) => {
        if (prev <= 1) {
          onRefreshData();
          return 60;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [onRefreshData]);

  // ESC sai do Modo TV
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isTvMode) {
        setIsTvMode(false);
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(() => {});
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isTvMode]);

  const handleToggleTvMode = () => {
    const next = !isTvMode;
    setIsTvMode(next);
    if (next) {
      document.documentElement.requestFullscreen?.().catch(() => {});
    } else if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
  };

  const handleManualRefresh = () => {
    setIsRefreshing(true);
    onRefreshData();
    setSecondsToRefresh(60);
    setTimeout(() => setIsRefreshing(false), 600);
  };

  const getCityName = (id: string) => {
    const c = cities.find((item) => item.id === id);
    return c ? `${c.name}-${c.state}` : id;
  };

  const getVehicle = (id?: string) => vehicles.find((v) => v.id === id);
  const getDriver = (id?: string) => drivers.find((d) => d.id === id);

  /**
   * Status operacional ao vivo 100% atrelado às ações do motorista no celular:
   * - Sem veículo/pendente -> 'pending_dispatch'
   * - Check-out feito ou relatório finalizado -> 'finished'
   * - Check-in feito:
   *    * Se já iniciou trecho de retorno/volta (trip_legs) OU está no terço final/janela de retorno -> 'returning' (Retornando)
   *    * Caso contrário -> 'in_progress' (Em Viagem)
   * - Escalado sem check-in:
   *    * Faltando <= 60 min -> 'imminent' (Embarque Próximo)
   *    * Caso contrário -> 'scheduled' (Aguardando Saída)
   */
  const classifyTrip = (trip: TripRequest): LiveStatus => {
    if (trip.status === 'Pendente de Análise' || !trip.allocated_vehicle_id) {
      return 'pending_dispatch';
    }
    const isFinished =
      Boolean(trip.driver_checkout_at) ||
      trip.travel_report_status === 'Finalizado no Sistema' ||
      trip.travel_report_status === 'Aguardando a Apreciação do Gerente';
    if (isFinished) return 'finished';

    if (trip.driver_checkin_at) {
      // Só muda para 'returning' (Retornando) quando o motorista efetivamente informar
      // o KM de saída no trecho de retorno (trecho 2+ em trip_legs)
      const legs = Array.isArray(trip.trip_legs) ? trip.trip_legs : [];
      const hasReturnKmStarted = legs.some(
        (leg, idx) =>
          idx > 0 &&
          ((typeof leg.odometer_start === 'number' && leg.odometer_start > 0) ||
            Boolean(leg.started_at))
      );

      if (hasReturnKmStarted) return 'returning';

      return 'in_progress';
    }

    try {
      const dep = parseISO(trip.departure_datetime);
      if (isValid(dep)) {
        const mins = differenceInMinutes(dep, now);
        if (mins >= -30 && mins <= 60) {
          return 'imminent';
        }
      }
    } catch {
      // ignore
    }
    return 'scheduled';
  };

  const { todayTrips, tomorrowTrips, inProgressCount, returningCount } = useMemo(() => {
    const validTrips = trips.filter(
      (t) => t.status !== 'Indeferido' && !t.status.includes('Cancelado')
    );

    const todayList: TripRequest[] = [];
    const tomorrowList: TripRequest[] = [];
    let onGoing = 0;
    let returning = 0;

    validTrips.forEach((t) => {
      const live = classifyTrip(t);
      if (live === 'in_progress') onGoing += 1;
      if (live === 'returning') returning += 1;

      try {
        const dep = parseISO(t.departure_datetime);
        if (!isValid(dep)) return;
        if (isToday(dep)) {
          todayList.push(t);
        } else if (isTomorrow(dep)) {
          tomorrowList.push(t);
        } else if (live === 'in_progress' || live === 'returning') {
          todayList.push(t);
        }
      } catch {
        // ignore
      }
    });

    const sortByDeparture = (a: TripRequest, b: TripRequest) =>
      String(a.departure_datetime || '').localeCompare(String(b.departure_datetime || ''));

    todayList.sort(sortByDeparture);
    tomorrowList.sort(sortByDeparture);

    return {
      todayTrips: todayList,
      tomorrowTrips: tomorrowList,
      inProgressCount: onGoing,
      returningCount: returning,
    };
  }, [trips, now]);

  const kpis = useMemo(() => {
    const awaitingToday = todayTrips.filter((t) => {
      const s = classifyTrip(t);
      return s === 'scheduled' || s === 'imminent';
    }).length;
    const finishedToday = todayTrips.filter((t) => classifyTrip(t) === 'finished').length;
    const pendingDispatchToday = todayTrips.filter((t) => classifyTrip(t) === 'pending_dispatch').length;
    return {
      onRoadTotal: inProgressCount + returningCount,
      inProgress: inProgressCount,
      returning: returningCount,
      awaitingToday,
      finishedToday,
      pendingDispatchToday,
      tomorrowTotal: tomorrowTrips.length,
    };
  }, [todayTrips, tomorrowTrips, inProgressCount, returningCount]);

  const visibleSections = useMemo(() => {
    const filterList = (list: TripRequest[]) =>
      onlyActiveOnRoad
        ? list.filter((t) => {
            const s = classifyTrip(t);
            return s === 'in_progress' || s === 'returning';
          })
        : list;

    const sections: Array<{ key: string; title: string; subtitle: string; items: TripRequest[] }> = [];
    if (scope === 'today' || scope === 'both') {
      sections.push({
        key: 'today',
        title: 'Saídas de Hoje',
        subtitle: format(now, "EEEE, dd 'de' MMMM", { locale: ptBR }),
        items: filterList(todayTrips),
      });
    }
    if (scope === 'tomorrow' || scope === 'both') {
      const tomorrowDate = new Date(now);
      tomorrowDate.setDate(tomorrowDate.getDate() + 1);
      sections.push({
        key: 'tomorrow',
        title: 'Saídas de Amanhã',
        subtitle: format(tomorrowDate, "EEEE, dd 'de' MMMM", { locale: ptBR }),
        items: filterList(tomorrowTrips),
      });
    }
    return sections;
  }, [scope, onlyActiveOnRoad, todayTrips, tomorrowTrips, now]);

  const getStatusTheme = (live: LiveStatus) => {
    switch (live) {
      case 'in_progress':
        return {
          label: 'Em Viagem',
          topBar: 'bg-sky-500',
          badgeLight: 'bg-sky-100 text-sky-900 border-sky-300',
          badgeDark: 'bg-sky-500/20 text-sky-300 border-sky-400/40',
          dot: 'bg-sky-500 animate-pulse',
          stepIndex: 1,
        };
      case 'returning':
        return {
          label: 'Retornando',
          topBar: 'bg-violet-600',
          badgeLight: 'bg-violet-100 text-violet-900 border-violet-300',
          badgeDark: 'bg-violet-500/25 text-violet-200 border-violet-400/50',
          dot: 'bg-violet-500 animate-pulse',
          stepIndex: 2,
        };
      case 'imminent':
        return {
          label: 'Embarque Próximo',
          topBar: 'bg-amber-500',
          badgeLight: 'bg-amber-100 text-amber-900 border-amber-300',
          badgeDark: 'bg-amber-500/20 text-amber-300 border-amber-400/50',
          dot: 'bg-amber-500 animate-ping',
          stepIndex: 0,
        };
      case 'finished':
        return {
          label: 'Concluída',
          topBar: 'bg-emerald-500',
          badgeLight: 'bg-emerald-100 text-emerald-900 border-emerald-300',
          badgeDark: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40',
          dot: 'bg-emerald-500',
          stepIndex: 3,
        };
      case 'pending_dispatch':
        return {
          label: 'Sem Escala',
          topBar: 'bg-rose-600',
          badgeLight: 'bg-rose-100 text-rose-900 border-rose-300',
          badgeDark: 'bg-rose-500/20 text-rose-300 border-rose-400/50',
          dot: 'bg-rose-500',
          stepIndex: -1,
        };
      default:
        return {
          label: 'Aguardando Saída',
          topBar: 'bg-slate-400',
          badgeLight: 'bg-slate-100 text-slate-700 border-slate-300',
          badgeDark: 'bg-slate-800 text-slate-200 border-slate-700',
          dot: 'bg-slate-400',
          stepIndex: 0,
        };
    }
  };

  return (
    <div
      className={
        isTvMode
          ? 'fixed inset-0 z-50 bg-slate-950 text-white overflow-y-auto p-5 sm:p-8 space-y-6'
          : 'space-y-6 pb-10'
      }
    >
      {/* CABEÇALHO AO VIVO */}
      <div
        className={`rounded-3xl p-5 sm:p-6 border shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4 ${
          isTvMode
            ? 'bg-slate-900 border-slate-800 text-white'
            : 'bg-gradient-to-br from-navy-950 via-navy-900 to-brand-900 border-navy-800 text-white'
        }`}
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-brand-600/90 flex items-center justify-center shadow-lg shrink-0">
            <Radio className="w-6 h-6 text-white animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                Ao Vivo • Integrado ao App do Motorista
              </span>
              <span className="text-[11px] text-slate-300">
                Atualiza em {secondsToRefresh}s
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight mt-0.5">
              Quadro de Saídas da Frota
            </h1>
            <p className="text-xs text-slate-300 capitalize">
              {format(now, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
            </p>
          </div>
        </div>

        {/* Relógio Digital + Controles */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="px-4 py-2 rounded-2xl bg-black/30 border border-white/15 font-mono text-2xl sm:text-3xl font-black tracking-wider text-white">
            {format(now, 'HH:mm:ss')}
          </div>

          <button
            type="button"
            onClick={handleManualRefresh}
            className="px-3.5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-xs font-bold text-white flex items-center gap-1.5 transition-colors"
            title="Atualizar agora"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Atualizar</span>
          </button>

          <button
            type="button"
            onClick={handleToggleTvMode}
            className={`px-4 py-2.5 rounded-xl text-xs font-extrabold flex items-center gap-2 transition-colors shadow-md ${
              isTvMode
                ? 'bg-rose-600 hover:bg-rose-500 text-white'
                : 'bg-white text-navy-950 hover:bg-slate-100'
            }`}
          >
            {isTvMode ? (
              <>
                <Minimize2 className="w-4 h-4" />
                <span>Sair do Modo TV</span>
              </>
            ) : (
              <>
                <Maximize2 className="w-4 h-4" />
                <span>Modo Tela Cheia / TV</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 5 CARDS DE CONTADORES AO VIVO */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className={`rounded-2xl p-4 border ${isTvMode ? 'bg-sky-950/60 border-sky-800' : 'bg-sky-50 border-sky-200'}`}>
          <div className={`text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1.5 ${isTvMode ? 'text-sky-300' : 'text-sky-700'}`}>
            <Navigation className="w-3.5 h-3.5" />
            Em Viagem (Ida)
          </div>
          <div className={`text-3xl font-black mt-1 ${isTvMode ? 'text-white' : 'text-sky-950'}`}>
            {kpis.inProgress}
          </div>
          <div className={`text-[10.5px] mt-0.5 ${isTvMode ? 'text-sky-200/80' : 'text-sky-800/80'}`}>
            Check-in registrado
          </div>
        </div>

        <div className={`rounded-2xl p-4 border ${isTvMode ? 'bg-violet-950/60 border-violet-800' : 'bg-violet-50 border-violet-200'}`}>
          <div className={`text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1.5 ${isTvMode ? 'text-violet-300' : 'text-violet-700'}`}>
            <CornerDownLeft className="w-3.5 h-3.5" />
            Retornando
          </div>
          <div className={`text-3xl font-black mt-1 ${isTvMode ? 'text-white' : 'text-violet-950'}`}>
            {kpis.returning}
          </div>
          <div className={`text-[10.5px] mt-0.5 ${isTvMode ? 'text-violet-200/80' : 'text-violet-800/80'}`}>
            Em percurso de volta
          </div>
        </div>

        <div className={`rounded-2xl p-4 border ${isTvMode ? 'bg-amber-950/50 border-amber-800' : 'bg-amber-50 border-amber-200'}`}>
          <div className={`text-[10px] font-extrabold uppercase tracking-wider ${isTvMode ? 'text-amber-300' : 'text-amber-700'}`}>
            Aguardando Hoje
          </div>
          <div className={`text-3xl font-black mt-1 ${isTvMode ? 'text-white' : 'text-amber-950'}`}>
            {kpis.awaitingToday}
          </div>
          <div className={`text-[10.5px] mt-0.5 ${isTvMode ? 'text-amber-200/80' : 'text-amber-800/80'}`}>
            {kpis.pendingDispatchToday > 0
              ? `⚠ ${kpis.pendingDispatchToday} sem escala`
              : 'Todas escaladas'}
          </div>
        </div>

        <div className={`rounded-2xl p-4 border ${isTvMode ? 'bg-emerald-950/50 border-emerald-800' : 'bg-emerald-50 border-emerald-200'}`}>
          <div className={`text-[10px] font-extrabold uppercase tracking-wider ${isTvMode ? 'text-emerald-300' : 'text-emerald-700'}`}>
            Concluídas Hoje
          </div>
          <div className={`text-3xl font-black mt-1 ${isTvMode ? 'text-white' : 'text-emerald-950'}`}>
            {kpis.finishedToday}
          </div>
          <div className={`text-[10.5px] mt-0.5 ${isTvMode ? 'text-emerald-200/80' : 'text-emerald-800/80'}`}>
            Check-out finalizado
          </div>
        </div>

        <div className={`rounded-2xl p-4 border col-span-2 md:col-span-1 ${isTvMode ? 'bg-indigo-950/50 border-indigo-800' : 'bg-indigo-50 border-indigo-200'}`}>
          <div className={`text-[10px] font-extrabold uppercase tracking-wider ${isTvMode ? 'text-indigo-300' : 'text-indigo-700'}`}>
            Saídas Amanhã
          </div>
          <div className={`text-3xl font-black mt-1 ${isTvMode ? 'text-white' : 'text-indigo-950'}`}>
            {kpis.tomorrowTotal}
          </div>
          <div className={`text-[10.5px] mt-0.5 ${isTvMode ? 'text-indigo-200/80' : 'text-indigo-800/80'}`}>
            Programação seguinte
          </div>
        </div>
      </div>

      {/* FILTROS RÁPIDOS */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          className={`inline-flex p-1 rounded-xl border text-xs font-bold ${
            isTvMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-2xs'
          }`}
        >
          {[
            { id: 'both' as BoardScope, label: `Hoje + Amanhã (${todayTrips.length + tomorrowTrips.length})` },
            { id: 'today' as BoardScope, label: `Hoje (${todayTrips.length})` },
            { id: 'tomorrow' as BoardScope, label: `Amanhã (${tomorrowTrips.length})` },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setScope(tab.id)}
              className={`px-3.5 py-1.5 rounded-lg transition-all ${
                scope === tab.id
                  ? isTvMode
                    ? 'bg-brand-600 text-white'
                    : 'bg-navy-950 text-white shadow-xs'
                  : isTvMode
                  ? 'text-slate-400 hover:text-white'
                  : 'text-slate-600 hover:text-navy-950'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setOnlyActiveOnRoad((prev) => !prev)}
          className={`px-3.5 py-2 rounded-xl border text-xs font-bold flex items-center gap-2 transition-all ${
            onlyActiveOnRoad
              ? 'bg-sky-600 text-white border-sky-600 shadow-sm'
              : isTvMode
              ? 'bg-slate-900 text-slate-300 border-slate-700 hover:border-sky-500'
              : 'bg-white text-slate-700 border-slate-200 hover:border-sky-300'
          }`}
        >
          <span className={`w-2 h-2 rounded-full ${onlyActiveOnRoad ? 'bg-white animate-pulse' : 'bg-sky-500'}`} />
          <span>Na Estrada Agora (Em Viagem / Retornando: {kpis.onRoadTotal})</span>
        </button>
      </div>

      {/* SEÇÕES EM GRID DE CARDS */}
      <div className="space-y-7">
        {visibleSections.map((section) => (
          <div key={section.key} className="space-y-3.5">
            <div className="flex items-center justify-between border-b pb-2 border-slate-200/20">
              <div className="flex items-center gap-2.5">
                <Calendar className={`w-5 h-5 ${isTvMode ? 'text-brand-400' : 'text-brand-600'}`} />
                <h2 className={`text-base sm:text-lg font-extrabold ${isTvMode ? 'text-white' : 'text-navy-950'}`}>
                  {section.title}
                </h2>
                <span className={`text-xs capitalize ${isTvMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  — {section.subtitle}
                </span>
              </div>
              <span
                className={`text-xs font-extrabold px-2.5 py-0.5 rounded-full ${
                  isTvMode ? 'bg-slate-800 text-slate-200' : 'bg-slate-200 text-slate-700'
                }`}
              >
                {section.items.length} {section.items.length === 1 ? 'viagem' : 'viagens'}
              </span>
            </div>

            {section.items.length === 0 ? (
              <div
                className={`rounded-2xl border border-dashed p-8 text-center text-xs ${
                  isTvMode
                    ? 'bg-slate-900/50 border-slate-800 text-slate-400'
                    : 'bg-white border-slate-300 text-slate-500'
                }`}
              >
                Nenhuma viagem programada para este filtro.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {section.items.map((trip) => {
                  const live = classifyTrip(trip);
                  const theme = getStatusTheme(live);
                  const veh = getVehicle(trip.allocated_vehicle_id);
                  const drv = getDriver(trip.allocated_driver_id);
                  const returnStartedAt = Array.isArray(trip.trip_legs)
                    ? trip.trip_legs.find((l, idx) => idx > 0 && Boolean(l.started_at))?.started_at ||
                      trip.trip_legs[0]?.finished_at
                    : undefined;
                  const returnTimeFormatted = returnStartedAt
                    ? safeFormatDate(returnStartedAt, 'HH:mm', '')
                    : '';
                  const checkinTimeFormatted = trip.driver_checkin_at
                    ? safeFormatDate(trip.driver_checkin_at, 'HH:mm', '')
                    : '';
                  const occupancyPct =
                    veh && veh.capacity > 0
                      ? Math.min(100, Math.round((trip.passenger_count / veh.capacity) * 100))
                      : 0;

                  return (
                    <div
                      key={trip.id}
                      className={`rounded-2xl border overflow-hidden flex flex-col justify-between transition-all ${
                        isTvMode
                          ? 'bg-slate-900 border-slate-800 hover:border-slate-700'
                          : 'bg-white border-slate-200/90 shadow-card hover:shadow-lg hover:border-brand-300/70'
                      }`}
                    >
                      {/* Faixa superior colorida pelo status ao vivo */}
                      <div className={`h-1.5 w-full ${theme.topBar}`} />

                      <div className="p-4 sm:p-5 space-y-4 flex-1 flex flex-col justify-between">
                        {/* Topo do Card: Horário + Status Badge Ao Vivo */}
                        <div className="space-y-3">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div
                                className={`font-mono font-black tracking-tight leading-none ${
                                  isTvMode ? 'text-3xl text-white' : 'text-2xl text-navy-950'
                                }`}
                              >
                                {safeFormatDate(trip.departure_datetime, 'HH:mm', '--:--')}
                              </div>
                              <div className={`text-[11px] font-semibold mt-1 ${isTvMode ? 'text-slate-400' : 'text-slate-500'}`}>
                                Retorno: {safeFormatDate(trip.return_datetime, 'dd/MM HH:mm', '-')}
                              </div>
                            </div>

                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10.5px] font-extrabold uppercase tracking-wider shrink-0 ${
                                isTvMode ? theme.badgeDark : theme.badgeLight
                              }`}
                            >
                              <span className={`w-2 h-2 rounded-full ${theme.dot}`} />
                              <span>
                                {theme.label}
                                {live === 'returning' && returnTimeFormatted
                                  ? ` • ${returnTimeFormatted}`
                                  : live === 'in_progress' && checkinTimeFormatted
                                  ? ` • ${checkinTimeFormatted}`
                                  : ''}
                              </span>
                            </span>
                          </div>

                          {/* Rota + Processo SEI + Unidade */}
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span
                                className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded ${
                                  isTvMode ? 'bg-slate-800 text-slate-200' : 'bg-slate-100 text-slate-700'
                                }`}
                              >
                                {trip.process_number}
                              </span>
                              <span className="text-[11px] font-extrabold text-brand-500">
                                {trip.macro_unit}
                              </span>
                              <span className={`text-[11px] ${isTvMode ? 'text-slate-400' : 'text-slate-500'}`}>
                                • {trip.activity_type}
                              </span>
                            </div>

                            <div
                              className={`font-extrabold flex items-center gap-1.5 ${
                                isTvMode ? 'text-base text-white' : 'text-sm text-navy-950'
                              }`}
                            >
                              <MapPin className="w-4 h-4 text-brand-500 shrink-0" />
                              <span className="truncate">
                                {getCityName(trip.origin_city_id)} ➔ {getCityName(trip.destination_city_id)}
                              </span>
                            </div>

                            <div className={`text-xs truncate ${isTvMode ? 'text-slate-400' : 'text-slate-500'}`}>
                              Solicitante: <strong className={isTvMode ? 'text-slate-200' : 'text-slate-700'}>{trip.requester_name}</strong>
                            </div>
                          </div>

                          {/* Bloco de Dados do Veículo + Motorista */}
                          {veh ? (
                            <div
                              className={`rounded-xl p-3 border space-y-2 ${
                                isTvMode
                                  ? 'bg-slate-950/70 border-slate-800'
                                  : 'bg-slate-50/90 border-slate-200/80'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="px-2 py-0.5 rounded-md bg-navy-950 text-white font-mono font-black text-xs tracking-wider border border-slate-700 shrink-0">
                                    {veh.plate}
                                  </span>
                                  <span className={`text-xs font-bold truncate ${isTvMode ? 'text-slate-200' : 'text-slate-800'}`}>
                                    {veh.model}
                                  </span>
                                </div>
                                <span
                                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${
                                    isTvMode
                                      ? 'bg-slate-800 text-slate-300'
                                      : 'bg-white text-slate-600 border border-slate-200'
                                  }`}
                                >
                                  {veh.type}
                                </span>
                              </div>

                              <div className="flex items-center justify-between gap-2 text-[11px]">
                                <div className={`flex items-center gap-1.5 min-w-0 ${isTvMode ? 'text-slate-300' : 'text-slate-700'}`}>
                                  <User className="w-3.5 h-3.5 text-brand-500 shrink-0" />
                                  <span className="font-bold truncate">
                                    {drv ? drv.name : 'Motorista não definido'}
                                  </span>
                                </div>
                                <div className={`flex items-center gap-1 font-bold shrink-0 ${isTvMode ? 'text-slate-300' : 'text-slate-600'}`}>
                                  <Users className="w-3.5 h-3.5 text-slate-400" />
                                  <span>
                                    {trip.passenger_count}/{veh.capacity}
                                  </span>
                                </div>
                              </div>

                              {/* Barra discreta de ocupação + KM/Hodômetro ao vivo */}
                              <div className="space-y-1">
                                <div className={`w-full h-1.5 rounded-full overflow-hidden ${isTvMode ? 'bg-slate-800' : 'bg-slate-200'}`}>
                                  <div
                                    className="h-full bg-brand-600 rounded-full"
                                    style={{ width: `${occupancyPct}%` }}
                                  />
                                </div>
                                <div className={`flex items-center justify-between text-[10px] ${isTvMode ? 'text-slate-400' : 'text-slate-500'}`}>
                                  <span className="flex items-center gap-1">
                                    <Gauge className="w-3 h-3" />
                                    {trip.real_km && trip.real_km > 0
                                      ? `KM Real: ${trip.real_km} km`
                                      : trip.odometer_start
                                      ? `Saída: ${trip.odometer_start.toLocaleString('pt-BR')} km`
                                      : `Est.: ${trip.estimated_km} km`}
                                  </span>
                                  <span>
                                    {veh.ownership_type === 'propria' ? 'Frota Própria' : 'Contratada'}
                                  </span>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div
                              className={`rounded-xl p-3 border text-xs font-bold flex items-center gap-2 ${
                                isTvMode
                                  ? 'bg-rose-950/40 border-rose-800 text-rose-300'
                                  : 'bg-rose-50 border-rose-200 text-rose-700'
                              }`}
                            >
                              <AlertTriangle className="w-4 h-4 shrink-0" />
                              <span>Veículo e motorista ainda não escalados</span>
                            </div>
                          )}
                        </div>

                        {/* Linha de Progresso Ao Vivo (atrelada ao Check-in / Retorno / Check-out do Motorista) */}
                        <div className="pt-3 border-t border-slate-200/20 space-y-2.5">
                          <div className="grid grid-cols-3 gap-1.5 text-[10px] text-center font-bold">
                            <div
                              className={`py-1 px-1.5 rounded-lg border ${
                                theme.stepIndex >= 1
                                  ? isTvMode
                                    ? 'bg-sky-500/20 border-sky-500/40 text-sky-300'
                                    : 'bg-sky-50 border-sky-200 text-sky-800'
                                  : isTvMode
                                  ? 'bg-slate-800/60 border-slate-800 text-slate-500'
                                  : 'bg-slate-50 border-slate-200 text-slate-400'
                              }`}
                            >
                              {trip.driver_checkin_at
                                ? `✓ Saiu ${safeFormatDate(trip.driver_checkin_at, 'HH:mm', '')}`
                                : '1. Saída'}
                            </div>
                            <div
                              className={`py-1 px-1.5 rounded-lg border ${
                                theme.stepIndex >= 2
                                  ? isTvMode
                                    ? 'bg-violet-500/25 border-violet-500/50 text-violet-200'
                                    : 'bg-violet-50 border-violet-200 text-violet-800'
                                  : isTvMode
                                  ? 'bg-slate-800/60 border-slate-800 text-slate-500'
                                  : 'bg-slate-50 border-slate-200 text-slate-400'
                              }`}
                            >
                              {live === 'returning'
                                ? `↩ Retornando${returnTimeFormatted ? ` ${returnTimeFormatted}` : ''}`
                                : theme.stepIndex >= 3
                                ? `✓ Retornou${returnTimeFormatted ? ` ${returnTimeFormatted}` : ''}`
                                : '2. Retorno'}
                            </div>
                            <div
                              className={`py-1 px-1.5 rounded-lg border ${
                                theme.stepIndex >= 3
                                  ? isTvMode
                                    ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                                    : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                                  : isTvMode
                                  ? 'bg-slate-800/60 border-slate-800 text-slate-500'
                                  : 'bg-slate-50 border-slate-200 text-slate-400'
                              }`}
                            >
                              {trip.driver_checkout_at
                                ? `✓ Fim ${safeFormatDate(trip.driver_checkout_at, 'HH:mm', '')}`
                                : '3. Chegada'}
                            </div>
                          </div>

                          {/* Botões de Ação (apenas no modo desktop normal) */}
                          {!isTvMode && (
                            <div className="flex items-center justify-end gap-1.5">
                              {live === 'pending_dispatch' ? (
                                <button
                                  type="button"
                                  onClick={() => onOpenDispatchModal(trip)}
                                  className="px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-[11px] font-bold flex items-center gap-1 transition-colors"
                                >
                                  <SendHorizontal className="w-3.5 h-3.5" />
                                  <span>Escalar Agora</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => onOpenTrafficOrderModal(trip)}
                                  className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold flex items-center gap-1 transition-colors"
                                  title="Abrir Ordem de Tráfego (QR Code)"
                                >
                                  <QrCode className="w-3.5 h-3.5" />
                                  <span>OT / QR</span>
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => onSelectTripDetail(trip)}
                                className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold flex items-center gap-1 transition-colors"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>Detalhes</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
