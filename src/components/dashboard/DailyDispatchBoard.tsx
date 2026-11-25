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

type LiveStatus = 'in_progress' | 'imminent' | 'scheduled' | 'finished' | 'pending_dispatch';

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
  const [onlyInProgress, setOnlyInProgress] = useState(false);
  const [isTvMode, setIsTvMode] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [secondsToRefresh, setSecondsToRefresh] = useState(60);

  // Relógio ao vivo (atualiza a cada segundo) + auto-refresh a cada 60s
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

  const classifyTrip = (trip: TripRequest): LiveStatus => {
    if (trip.status === 'Pendente de Análise' || !trip.allocated_vehicle_id) {
      return 'pending_dispatch';
    }
    const isFinished =
      Boolean(trip.driver_checkout_at) ||
      trip.travel_report_status === 'Finalizado no Sistema' ||
      trip.travel_report_status === 'Aguardando a Apreciação do Gerente';
    if (isFinished) return 'finished';

    if (trip.driver_checkin_at) return 'in_progress';

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

  // Filtra viagens ativas (exclui Indeferido e Cancelado) para Hoje e Amanhã + qualquer viagem "Em Viagem" agora
  const { todayTrips, tomorrowTrips, activeInProgressCount } = useMemo(() => {
    const validTrips = trips.filter(
      (t) => t.status !== 'Indeferido' && !t.status.includes('Cancelado')
    );

    const todayList: TripRequest[] = [];
    const tomorrowList: TripRequest[] = [];
    let inProgressTotal = 0;

    validTrips.forEach((t) => {
      const live = classifyTrip(t);
      if (live === 'in_progress') inProgressTotal += 1;

      try {
        const dep = parseISO(t.departure_datetime);
        if (!isValid(dep)) return;
        if (isToday(dep)) {
          todayList.push(t);
        } else if (isTomorrow(dep)) {
          tomorrowList.push(t);
        } else if (live === 'in_progress') {
          // Viagem iniciada ontem mas ainda em andamento hoje aparece no topo do quadro de hoje
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
      activeInProgressCount: inProgressTotal,
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
      inProgress: activeInProgressCount,
      awaitingToday,
      finishedToday,
      pendingDispatchToday,
      tomorrowTotal: tomorrowTrips.length,
    };
  }, [todayTrips, tomorrowTrips, activeInProgressCount]);

  const visibleSections = useMemo(() => {
    const filterList = (list: TripRequest[]) =>
      onlyInProgress ? list.filter((t) => classifyTrip(t) === 'in_progress') : list;

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
  }, [scope, onlyInProgress, todayTrips, tomorrowTrips, now]);

  const renderStatusBadge = (trip: TripRequest, live: LiveStatus) => {
    switch (live) {
      case 'in_progress':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-sky-500/20 text-sky-300 border border-sky-400/40 text-[11px] font-extrabold uppercase tracking-wider">
            <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
            Em Viagem • {safeFormatDate(trip.driver_checkin_at, 'HH:mm', '')}
          </span>
        );
      case 'imminent':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/50 text-[11px] font-extrabold uppercase tracking-wider">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
            Embarque Próximo
          </span>
        );
      case 'finished':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 text-[11px] font-extrabold uppercase tracking-wider">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Concluída
          </span>
        );
      case 'pending_dispatch':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-500/20 text-rose-300 border border-rose-400/50 text-[11px] font-extrabold uppercase tracking-wider">
            <AlertTriangle className="w-3.5 h-3.5" />
            Sem Escala
          </span>
        );
      default:
        return (
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wider border ${
              isTvMode
                ? 'bg-slate-800 text-slate-200 border-slate-700'
                : 'bg-amber-50 text-amber-800 border-amber-200'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            Aguardando Saída
          </span>
        );
    }
  };

  const renderLightStatusBadge = (trip: TripRequest, live: LiveStatus) => {
    if (isTvMode) return renderStatusBadge(trip, live);
    switch (live) {
      case 'in_progress':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-sky-100 text-sky-900 border border-sky-300 text-[11px] font-extrabold uppercase tracking-wider">
            <span className="w-2 h-2 rounded-full bg-sky-600 animate-pulse" />
            Em Viagem • {safeFormatDate(trip.driver_checkin_at, 'HH:mm', '')}
          </span>
        );
      case 'imminent':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-100 text-amber-900 border border-amber-300 text-[11px] font-extrabold uppercase tracking-wider">
            <span className="w-2 h-2 rounded-full bg-amber-600 animate-ping" />
            Embarque Próximo
          </span>
        );
      case 'finished':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300 text-[11px] font-extrabold uppercase tracking-wider">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            Concluída
          </span>
        );
      case 'pending_dispatch':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-100 text-rose-900 border border-rose-300 text-[11px] font-extrabold uppercase tracking-wider">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
            Sem Escala
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-300 text-[11px] font-extrabold uppercase tracking-wider">
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            Aguardando Saída
          </span>
        );
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
                Ao Vivo • DIVTRANS / UNILAB
              </span>
              <span className="text-[11px] text-slate-300">
                Atualização automática em {secondsToRefresh}s
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
            title="Atualizar dados agora"
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

      {/* 4 CARDS DE CONTADORES AO VIVO */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div
          className={`rounded-2xl p-4 border ${
            isTvMode ? 'bg-sky-950/60 border-sky-800' : 'bg-sky-50 border-sky-200'
          }`}
        >
          <div className={`text-[11px] font-extrabold uppercase tracking-wider ${isTvMode ? 'text-sky-300' : 'text-sky-700'}`}>
            Em Viagem Agora
          </div>
          <div className={`text-3xl font-black mt-1 ${isTvMode ? 'text-white' : 'text-sky-950'}`}>
            {kpis.inProgress}
          </div>
          <div className={`text-[11px] mt-0.5 ${isTvMode ? 'text-sky-200/80' : 'text-sky-800/80'}`}>
            Check-in realizado em campo
          </div>
        </div>

        <div
          className={`rounded-2xl p-4 border ${
            isTvMode ? 'bg-amber-950/50 border-amber-800' : 'bg-amber-50 border-amber-200'
          }`}
        >
          <div className={`text-[11px] font-extrabold uppercase tracking-wider ${isTvMode ? 'text-amber-300' : 'text-amber-700'}`}>
            Aguardando Saída (Hoje)
          </div>
          <div className={`text-3xl font-black mt-1 ${isTvMode ? 'text-white' : 'text-amber-950'}`}>
            {kpis.awaitingToday}
          </div>
          <div className={`text-[11px] mt-0.5 ${isTvMode ? 'text-amber-200/80' : 'text-amber-800/80'}`}>
            {kpis.pendingDispatchToday > 0
              ? `⚠ ${kpis.pendingDispatchToday} pendente(s) de escala`
              : 'Todas escaladas'}
          </div>
        </div>

        <div
          className={`rounded-2xl p-4 border ${
            isTvMode ? 'bg-emerald-950/50 border-emerald-800' : 'bg-emerald-50 border-emerald-200'
          }`}
        >
          <div className={`text-[11px] font-extrabold uppercase tracking-wider ${isTvMode ? 'text-emerald-300' : 'text-emerald-700'}`}>
            Concluídas Hoje
          </div>
          <div className={`text-3xl font-black mt-1 ${isTvMode ? 'text-white' : 'text-emerald-950'}`}>
            {kpis.finishedToday}
          </div>
          <div className={`text-[11px] mt-0.5 ${isTvMode ? 'text-emerald-200/80' : 'text-emerald-800/80'}`}>
            Check-out / relatório enviado
          </div>
        </div>

        <div
          className={`rounded-2xl p-4 border ${
            isTvMode ? 'bg-indigo-950/50 border-indigo-800' : 'bg-indigo-50 border-indigo-200'
          }`}
        >
          <div className={`text-[11px] font-extrabold uppercase tracking-wider ${isTvMode ? 'text-indigo-300' : 'text-indigo-700'}`}>
            Saídas de Amanhã
          </div>
          <div className={`text-3xl font-black mt-1 ${isTvMode ? 'text-white' : 'text-indigo-950'}`}>
            {kpis.tomorrowTotal}
          </div>
          <div className={`text-[11px] mt-0.5 ${isTvMode ? 'text-indigo-200/80' : 'text-indigo-800/80'}`}>
            Programação do próximo dia
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
            { id: 'today' as BoardScope, label: `Somente Hoje (${todayTrips.length})` },
            { id: 'tomorrow' as BoardScope, label: `Somente Amanhã (${tomorrowTrips.length})` },
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
          onClick={() => setOnlyInProgress((prev) => !prev)}
          className={`px-3.5 py-2 rounded-xl border text-xs font-bold flex items-center gap-2 transition-all ${
            onlyInProgress
              ? 'bg-sky-600 text-white border-sky-600 shadow-sm'
              : isTvMode
              ? 'bg-slate-900 text-slate-300 border-slate-700 hover:border-sky-500'
              : 'bg-white text-slate-700 border-slate-200 hover:border-sky-300'
          }`}
        >
          <span className={`w-2 h-2 rounded-full ${onlyInProgress ? 'bg-white animate-pulse' : 'bg-sky-500'}`} />
          <span>Filtrar apenas Em Viagem ({kpis.inProgress})</span>
        </button>
      </div>

      {/* SEÇÕES DE SAÍDAS (HOJE / AMANHÃ) */}
      <div className="space-y-6">
        {visibleSections.map((section) => (
          <div key={section.key} className="space-y-3">
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
              <div className="space-y-3">
                {section.items.map((trip) => {
                  const live = classifyTrip(trip);
                  const veh = getVehicle(trip.allocated_vehicle_id);
                  const drv = getDriver(trip.allocated_driver_id);

                  const borderLeftColor =
                    live === 'in_progress'
                      ? 'border-l-sky-500'
                      : live === 'imminent'
                      ? 'border-l-amber-500'
                      : live === 'finished'
                      ? 'border-l-emerald-500'
                      : live === 'pending_dispatch'
                      ? 'border-l-rose-500'
                      : 'border-l-slate-400';

                  return (
                    <div
                      key={trip.id}
                      className={`rounded-2xl border border-l-[6px] ${borderLeftColor} p-4 sm:p-5 transition-all grid grid-cols-1 lg:grid-cols-12 gap-4 items-center ${
                        isTvMode
                          ? 'bg-slate-900 border-slate-800 hover:border-slate-700'
                          : 'bg-white border-slate-200/90 shadow-xs hover:shadow-md'
                      }`}
                    >
                      {/* Coluna 1: Horário em destaque */}
                      <div className="lg:col-span-2 flex lg:flex-col items-baseline lg:items-start justify-between gap-1">
                        <div
                          className={`font-mono font-black tracking-tight ${
                            isTvMode ? 'text-3xl text-white' : 'text-2xl text-navy-950'
                          }`}
                        >
                          {safeFormatDate(trip.departure_datetime, 'HH:mm', '--:--')}
                        </div>
                        <div className={`text-[11px] font-semibold ${isTvMode ? 'text-slate-400' : 'text-slate-500'}`}>
                          Retorno: {safeFormatDate(trip.return_datetime, 'dd/MM HH:mm', '-')}
                        </div>
                      </div>

                      {/* Coluna 2: Rota, Processo e Solicitante */}
                      <div className="lg:col-span-4 space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${
                              isTvMode ? 'bg-slate-800 text-slate-200' : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {trip.process_number}
                          </span>
                          <span className="text-[11px] font-extrabold text-brand-500">
                            {trip.macro_unit}
                          </span>
                        </div>
                        <div
                          className={`font-extrabold flex items-center gap-1.5 truncate ${
                            isTvMode ? 'text-base text-white' : 'text-sm text-navy-950'
                          }`}
                          title={`${getCityName(trip.origin_city_id)} → ${getCityName(trip.destination_city_id)}`}
                        >
                          <MapPin className="w-4 h-4 text-brand-500 shrink-0" />
                          <span className="truncate">
                            {getCityName(trip.origin_city_id)} ➔ {getCityName(trip.destination_city_id)}
                          </span>
                        </div>
                        <div className={`text-xs flex items-center gap-3 flex-wrap ${isTvMode ? 'text-slate-400' : 'text-slate-500'}`}>
                          <span className="truncate max-w-[200px]">{trip.requester_name}</span>
                          <span className="inline-flex items-center gap-1 font-bold">
                            <Users className="w-3.5 h-3.5" />
                            {trip.passenger_count} pax
                          </span>
                        </div>
                      </div>

                      {/* Coluna 3: Veículo e Motorista */}
                      <div className="lg:col-span-3 space-y-1">
                        {veh ? (
                          <>
                            <div className={`font-extrabold flex items-center gap-1.5 text-sm ${isTvMode ? 'text-white' : 'text-navy-950'}`}>
                              <Truck className="w-4 h-4 text-brand-500 shrink-0" />
                              <span className="font-mono tracking-wider">{veh.plate}</span>
                              <span className={`font-semibold text-xs truncate ${isTvMode ? 'text-slate-300' : 'text-slate-600'}`}>
                                • {veh.model}
                              </span>
                            </div>
                            <div className={`text-xs flex items-center gap-1.5 ${isTvMode ? 'text-slate-300' : 'text-slate-600'}`}>
                              <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span className="font-semibold truncate">{drv ? drv.name : 'Motorista não definido'}</span>
                            </div>
                          </>
                        ) : (
                          <div className="text-xs font-bold text-rose-500 flex items-center gap-1.5">
                            <AlertTriangle className="w-4 h-4 shrink-0" />
                            <span>Aguardando alocação de veículo/motorista</span>
                          </div>
                        )}
                      </div>

                      {/* Coluna 4: Status Ao Vivo + Ações Rápidas */}
                      <div className="lg:col-span-3 flex flex-col items-start lg:items-end justify-center gap-2">
                        {renderLightStatusBadge(trip, live)}

                        {!isTvMode && (
                          <div className="flex items-center gap-1.5">
                            {live === 'pending_dispatch' ? (
                              <button
                                type="button"
                                onClick={() => onOpenDispatchModal(trip)}
                                className="px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-[11px] font-bold flex items-center gap-1 transition-colors"
                              >
                                <SendHorizontal className="w-3.5 h-3.5" />
                                <span>Escalar</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => onOpenTrafficOrderModal(trip)}
                                className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold flex items-center gap-1 transition-colors"
                                title="Abrir Ordem de Tráfego (QR Code)"
                              >
                                <QrCode className="w-3.5 h-3.5" />
                                <span>OT</span>
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
