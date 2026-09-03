import React, { useState } from 'react';
import { TripRequest, Vehicle, Driver } from '../../types';
import { FleetService } from '../../services/fleetService';
import { DistanceService } from '../../services/distanceService';
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  Truck, 
  User, 
  Clock, 
  Eye,
  SendHorizontal,
  Info
} from 'lucide-react';
import { 
  format, 
  addMonths, 
  subMonths, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  isSameDay, 
  parseISO,
  isWithinInterval,
  startOfWeek,
  endOfWeek
} from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface CalendarViewProps {
  trips: TripRequest[];
  onSelectTripDetail: (trip: TripRequest) => void;
  onOpenDispatchModal: (trip: TripRequest) => void;
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  trips,
  onSelectTripDetail,
  onOpenDispatchModal,
}) => {
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<'vehicles' | 'drivers' | 'calendar'>('vehicles');

  const vehicles = FleetService.getVehicles();
  const drivers = FleetService.getDrivers();
  const cities = DistanceService.getCities();

  const getCityName = (id: string) => {
    const c = cities.find((item) => item.id === id);
    return c ? c.name : id;
  };

  const handlePrevMonth = () => setCurrentDate((prev) => subMonths(prev, 1));
  const handleNextMonth = () => setCurrentDate((prev) => addMonths(prev, 1));
  const handleToday = () => setCurrentDate(new Date());

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Dias para o grid mensal completo
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const fullCalendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  // Extrai [ano, mes, dia] de forma imune a fusos horários e variações de formato
  const extractDateParts = (dateVal: string | Date | undefined | null): { year: number; month: number; day: number } | null => {
    if (!dateVal) return null;
    if (typeof dateVal === 'string') {
      const clean = dateVal.trim();
      // 1. Formato ISO: YYYY-MM-DD... (ex: "2026-09-25T08:00:00Z" ou "2026-09-25")
      const isoMatch = clean.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
      if (isoMatch) {
        return {
          year: parseInt(isoMatch[1], 10),
          month: parseInt(isoMatch[2], 10),
          day: parseInt(isoMatch[3], 10),
        };
      }
      // 2. Formato Brasileiro: DD/MM/YYYY... (ex: "25/09/2026")
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
    } catch {
      return null;
    }
    return null;
  };

  // Helper para verificar se a viagem ocorre em determinado dia
  const isTripOnDay = (trip: TripRequest, targetDay: Date) => {
    try {
      const depParts = extractDateParts(trip.departure_datetime);
      if (!depParts) return false;

      let retParts = extractDateParts(trip.return_datetime);
      if (!retParts) retParts = depParts;

      const targetVal = targetDay.getFullYear() * 10000 + (targetDay.getMonth() + 1) * 100 + targetDay.getDate();
      const depVal = depParts.year * 10000 + depParts.month * 100 + depParts.day;
      let retVal = retParts.year * 10000 + retParts.month * 100 + retParts.day;

      if (retVal < depVal) {
        retVal = depVal;
      }

      return targetVal >= depVal && targetVal <= retVal;
    } catch {
      return false;
    }
  };

  // Viagens e contadores do mês vigente selecionado (independente de fuso horário)
  const curYear = currentDate.getFullYear();
  const curMonth = currentDate.getMonth() + 1;

  const monthTrips = trips.filter((t) => {
    const parts = extractDateParts(t.departure_datetime);
    if (!parts) return false;
    return parts.year === curYear && parts.month === curMonth;
  });

  const monthConfirmedCount = monthTrips.filter((t) => t.status === 'Confirmado ao Demandante').length;
  const monthPendingCount = monthTrips.filter((t) => t.status === 'Pendente de Análise').length;
  const monthRejectedCount = monthTrips.filter((t) => t.status === 'Indeferido').length;

  // Status color helper for Gantt pill badges
  const getGanttTripColor = (status: string) => {
    switch (status) {
      case 'Confirmado ao Demandante':
        return 'bg-emerald-600 hover:bg-emerald-700 text-white';
      case 'Indeferido':
        return 'bg-rose-600 hover:bg-rose-700 text-white';
      case 'Pendente de Análise':
        return 'bg-amber-400 hover:bg-amber-500 text-slate-950 font-extrabold';
      case 'Alterado a Data da Demanda':
        return 'bg-indigo-600 hover:bg-indigo-700 text-white';
      case 'Cancelado pelo Demandante':
      case 'Cancelado pela Unidade Executante':
        return 'bg-slate-500 hover:bg-slate-600 text-white';
      default:
        return 'bg-slate-600 hover:bg-slate-700 text-white';
    }
  };

  const ganttGridStyle = {
    gridTemplateColumns: `220px repeat(${daysInMonth.length}, minmax(44px, 1fr))`,
  };
  const ganttMinWidth = `${220 + daysInMonth.length * 44}px`;

  return (
    <div className="space-y-6">
      
      {/* Calendar Header & Controls */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-4 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-brand-600" />
            <h2 className="text-xl font-extrabold text-navy-950">
              Agenda & Alocação de Frotas
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Visualize a programação de viagens, ocupação dos veículos e escala dos motoristas
          </p>
        </div>

        {/* View Switchers & Month Navigator */}
        <div className="flex flex-wrap items-center gap-3">
          
          {/* View Mode Toggle */}
          <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-1 border border-slate-200">
            <button
              onClick={() => setViewMode('vehicles')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'vehicles'
                  ? 'bg-white text-navy-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Truck className="w-3.5 h-3.5 text-brand-600" />
              <span>Por Veículo (Gantt)</span>
            </button>

            <button
              onClick={() => setViewMode('drivers')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'drivers'
                  ? 'bg-white text-navy-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <User className="w-3.5 h-3.5 text-blue-600" />
              <span>Por Motorista</span>
            </button>

            <button
              onClick={() => setViewMode('calendar')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'calendar'
                  ? 'bg-white text-navy-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CalendarIcon className="w-3.5 h-3.5 text-purple-600" />
              <span>Grid Mensal</span>
            </button>
          </div>

          {/* Month Controls */}
          <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 px-2 py-1 rounded-xl">
            <button
              onClick={handlePrevMonth}
              className="p-1 text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded-lg transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-bold text-navy-900 px-2 capitalize min-w-[120px] text-center">
              {format(currentDate, 'MMMM yyyy', { locale: ptBR })}
            </span>
            <button
              onClick={handleNextMonth}
              className="p-1 text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded-lg transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={handleToday}
              className="ml-1 text-[11px] font-bold text-brand-700 bg-brand-50 hover:bg-brand-100 px-2 py-1 rounded-md transition-colors"
            >
              Hoje
            </button>
          </div>

        </div>
      </div>

      {/* VIEW 1: GANTT TIMELINE BY VEHICLE */}
      {viewMode === 'vehicles' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card overflow-hidden">
          <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Ocupação da Frota ({vehicles.length} veículos)
              </span>
              {/* Legenda de Cores dos Status com Contadores do Mês */}
              <div className="flex items-center gap-2 text-[10px] font-bold">
                <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md border border-emerald-300">
                  <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                  Confirmado ({monthConfirmedCount})
                </span>
                <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-800 px-2 py-0.5 rounded-md border border-amber-300">
                  <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                  Pendente ({monthPendingCount})
                </span>
                <span className="inline-flex items-center gap-1 bg-rose-100 text-rose-800 px-2 py-0.5 rounded-md border border-rose-300">
                  <span className="w-2 h-2 rounded-full bg-rose-600"></span>
                  Indeferido ({monthRejectedCount})
                </span>
              </div>
            </div>
            <span className="text-xs text-slate-500">
              Clique em qualquer viagem para ver detalhes ou gerenciar
            </span>
          </div>

          <div className="overflow-x-auto">
            <div style={{ minWidth: ganttMinWidth }}>
              
              {/* Day Headers */}
              <div
                className="grid bg-slate-100 border-b border-slate-200 text-center text-[11px] font-bold text-slate-600"
                style={ganttGridStyle}
              >
                <div className="p-2.5 text-left pl-4 sticky left-0 bg-slate-100 z-20 shadow-xs">
                  Veículo / Alocação
                </div>
                {daysInMonth.map((day) => {
                  const isToday = isSameDay(day, new Date());
                  return (
                    <div
                      key={day.toISOString()}
                      className={`p-1.5 border-l border-slate-200 flex flex-col items-center justify-center ${
                        isToday ? 'bg-slate-800 text-white font-extrabold' : ''
                      }`}
                    >
                      <span>{format(day, 'dd')}</span>
                      <span className="text-[9px] opacity-75">{format(day, 'EEE', { locale: ptBR })}</span>
                    </div>
                  );
                })}
              </div>

              {/* Linhas de Veículos Cadastrados */}
              <div className="divide-y divide-slate-100">
                {vehicles.map((v) => {
                  return (
                    <div
                      key={v.id}
                      className="grid hover:bg-slate-50/60 transition-colors min-h-[58px]"
                      style={ganttGridStyle}
                    >
                      {/* Vehicle Identity Column */}
                      <div className="p-2.5 pl-4 flex flex-col justify-center border-r border-slate-200 bg-white sticky left-0 z-20 shadow-xs">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-xs text-navy-950">{v.plate}</span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 font-semibold">
                            {v.type}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 truncate">{v.model} • {v.capacity}L</div>
                      </div>

                      {/* Day Cells */}
                      {daysInMonth.map((day) => {
                        const dayTrips = trips.filter((t) => {
                          if (t.allocated_vehicle_id !== v.id) return false;
                          return isTripOnDay(t, day);
                        });

                        return (
                          <div
                            key={day.toISOString()}
                            className="border-l border-slate-100 p-0.5 relative flex flex-col justify-center gap-1"
                          >
                            {dayTrips.map((trip) => {
                              return (
                                <div
                                  key={trip.id}
                                  onClick={() => onSelectTripDetail(trip)}
                                  title={`Processo: ${trip.process_number}\nSituação: ${trip.status}\nSolicitante: ${trip.requester_name}\nTrecho: ${getCityName(trip.origin_city_id)} -> ${getCityName(trip.destination_city_id)}`}
                                  className={`w-full rounded p-1 text-[9px] font-bold cursor-pointer truncate shadow-xs transition-transform hover:scale-105 z-10 ${getGanttTripColor(trip.status)}`}
                                >
                                  {trip.macro_unit}
                                </div>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}

                {/* Linha Especial 1: Demandas Pendentes de Análise (Aguardando Alocação de Frota) */}
                <div
                  className="grid bg-amber-50/40 hover:bg-amber-50/70 transition-colors min-h-[58px] border-t-2 border-amber-300"
                  style={ganttGridStyle}
                >
                  <div className="p-2.5 pl-4 flex flex-col justify-center border-r border-amber-200 bg-amber-50/95 sticky left-0 z-20 shadow-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse shrink-0"></span>
                      <span className="font-bold text-xs text-amber-950">Demandas Pendentes</span>
                    </div>
                    <div className="text-[10px] text-amber-800 font-semibold truncate">
                      Aguardando Escala de Frota
                    </div>
                  </div>

                  {daysInMonth.map((day) => {
                    const dayTrips = trips.filter((t) => {
                      if (t.status !== 'Pendente de Análise') return false;
                      if (t.allocated_vehicle_id) return false;
                      return isTripOnDay(t, day);
                    });

                    return (
                      <div
                        key={day.toISOString()}
                        className="border-l border-amber-100 p-0.5 relative flex flex-col justify-center gap-1 bg-amber-50/20"
                      >
                        {dayTrips.map((trip) => (
                          <div
                            key={trip.id}
                            onClick={() => onSelectTripDetail(trip)}
                            title={`Processo: ${trip.process_number}\nSituação: Pendente de Análise\nSolicitante: ${trip.requester_name}\nTrecho: ${getCityName(trip.origin_city_id)} -> ${getCityName(trip.destination_city_id)}`}
                            className="w-full rounded p-1 text-[9px] font-bold cursor-pointer truncate shadow-xs transition-transform hover:scale-105 z-10 bg-amber-400 hover:bg-amber-500 text-slate-950 border border-amber-500"
                          >
                            {trip.macro_unit}
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>

                {/* Linha Especial 2: Demandas Indeferidas */}
                <div
                  className="grid bg-rose-50/40 hover:bg-rose-50/70 transition-colors min-h-[58px] border-t border-rose-200"
                  style={ganttGridStyle}
                >
                  <div className="p-2.5 pl-4 flex flex-col justify-center border-r border-rose-200 bg-rose-50/95 sticky left-0 z-20 shadow-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-600 shrink-0"></span>
                      <span className="font-bold text-xs text-rose-950">Demandas Indeferidas</span>
                    </div>
                    <div className="text-[10px] text-rose-800 font-semibold truncate">
                      Não autorizadas / sem veículo
                    </div>
                  </div>

                  {daysInMonth.map((day) => {
                    const dayTrips = trips.filter((t) => {
                      if (t.status !== 'Indeferido') return false;
                      if (t.allocated_vehicle_id) return false;
                      return isTripOnDay(t, day);
                    });

                    return (
                      <div
                        key={day.toISOString()}
                        className="border-l border-rose-100 p-0.5 relative flex flex-col justify-center gap-1 bg-rose-50/20"
                      >
                        {dayTrips.map((trip) => (
                          <div
                            key={trip.id}
                            onClick={() => onSelectTripDetail(trip)}
                            title={`Processo: ${trip.process_number}\nSituação: Indeferido\nMotivo: ${trip.rejection_reason || 'Não informado'}\nSolicitante: ${trip.requester_name}\nTrecho: ${getCityName(trip.origin_city_id)} -> ${getCityName(trip.destination_city_id)}`}
                            className="w-full rounded p-1 text-[9px] font-bold cursor-pointer truncate shadow-xs transition-transform hover:scale-105 z-10 bg-rose-600 hover:bg-rose-700 text-white border border-rose-700"
                          >
                            {trip.macro_unit}
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>

              </div>

            </div>
          </div>
        </div>
      )}

      {/* VIEW 2: GANTT TIMELINE BY DRIVER */}
      {viewMode === 'drivers' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card overflow-hidden">
          <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Escala de Motoristas ({drivers.length} motoristas)
              </span>
              {/* Legenda de Cores dos Status com Contadores do Mês */}
              <div className="flex items-center gap-2 text-[10px] font-bold">
                <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md border border-emerald-300">
                  <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                  Confirmado ({monthConfirmedCount})
                </span>
                <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-800 px-2 py-0.5 rounded-md border border-amber-300">
                  <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                  Pendente ({monthPendingCount})
                </span>
                <span className="inline-flex items-center gap-1 bg-rose-100 text-rose-800 px-2 py-0.5 rounded-md border border-rose-300">
                  <span className="w-2 h-2 rounded-full bg-rose-600"></span>
                  Indeferido ({monthRejectedCount})
                </span>
              </div>
            </div>
            <span className="text-xs text-slate-500">
              Clique em qualquer escala para ver detalhes
            </span>
          </div>

          <div className="overflow-x-auto">
            <div style={{ minWidth: ganttMinWidth }}>
              
              {/* Day Headers */}
              <div
                className="grid bg-slate-100 border-b border-slate-200 text-center text-[11px] font-bold text-slate-600"
                style={ganttGridStyle}
              >
                <div className="p-2.5 text-left pl-4 sticky left-0 bg-slate-100 z-20 shadow-xs">
                  Motorista / CNH
                </div>
                {daysInMonth.map((day) => {
                  const isToday = isSameDay(day, new Date());
                  return (
                    <div
                      key={day.toISOString()}
                      className={`p-1.5 border-l border-slate-200 flex flex-col items-center justify-center ${
                        isToday ? 'bg-slate-800 text-white font-extrabold' : ''
                      }`}
                    >
                      <span>{format(day, 'dd')}</span>
                      <span className="text-[9px] opacity-75">{format(day, 'EEE', { locale: ptBR })}</span>
                    </div>
                  );
                })}
              </div>

              {/* Linhas de Motoristas Cadastrados */}
              <div className="divide-y divide-slate-100">
                {drivers.map((d) => {
                  return (
                    <div
                      key={d.id}
                      className="grid hover:bg-slate-50/60 transition-colors min-h-[58px]"
                      style={ganttGridStyle}
                    >
                      {/* Driver Identity Column */}
                      <div className="p-2.5 pl-4 flex flex-col justify-center border-r border-slate-200 bg-white sticky left-0 z-20 shadow-xs">
                        <div className="font-bold text-xs text-navy-950 truncate">{d.name}</div>
                        <div className="text-[11px] text-slate-500">
                          Cat: <span className="font-bold text-slate-700">{d.cnh_category}</span> • {d.driver_category}
                        </div>
                      </div>

                      {/* Day Cells */}
                      {daysInMonth.map((day) => {
                        const dayTrips = trips.filter((t) => {
                          if (t.allocated_driver_id !== d.id) return false;
                          return isTripOnDay(t, day);
                        });

                        return (
                          <div
                            key={day.toISOString()}
                            className="border-l border-slate-100 p-0.5 relative flex flex-col justify-center gap-1"
                          >
                            {dayTrips.map((trip) => {
                              return (
                                <div
                                  key={trip.id}
                                  onClick={() => onSelectTripDetail(trip)}
                                  title={`Processo: ${trip.process_number}\nSituação: ${trip.status}\nDestino: ${getCityName(trip.destination_city_id)}`}
                                  className={`w-full rounded p-1 text-[9px] font-bold cursor-pointer truncate shadow-xs transition-transform hover:scale-105 z-10 ${getGanttTripColor(trip.status)}`}
                                >
                                  {trip.macro_unit}
                                </div>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}

                {/* Linha Especial 1: Demandas Pendentes de Motorista */}
                <div
                  className="grid bg-amber-50/40 hover:bg-amber-50/70 transition-colors min-h-[58px] border-t-2 border-amber-300"
                  style={ganttGridStyle}
                >
                  <div className="p-2.5 pl-4 flex flex-col justify-center border-r border-amber-200 bg-amber-50/95 sticky left-0 z-20 shadow-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse shrink-0"></span>
                      <span className="font-bold text-xs text-amber-950">Demandas Pendentes</span>
                    </div>
                    <div className="text-[10px] text-amber-800 font-semibold truncate">
                      Aguardando Escala de Motorista
                    </div>
                  </div>

                  {daysInMonth.map((day) => {
                    const dayTrips = trips.filter((t) => {
                      if (t.status !== 'Pendente de Análise') return false;
                      if (t.allocated_driver_id) return false;
                      return isTripOnDay(t, day);
                    });

                    return (
                      <div
                        key={day.toISOString()}
                        className="border-l border-amber-100 p-0.5 relative flex flex-col justify-center gap-1 bg-amber-50/20"
                      >
                        {dayTrips.map((trip) => (
                          <div
                            key={trip.id}
                            onClick={() => onSelectTripDetail(trip)}
                            title={`Processo: ${trip.process_number}\nSituação: Pendente de Análise\nSolicitante: ${trip.requester_name}\nDestino: ${getCityName(trip.destination_city_id)}`}
                            className="w-full rounded p-1 text-[9px] font-bold cursor-pointer truncate shadow-xs transition-transform hover:scale-105 z-10 bg-amber-400 hover:bg-amber-500 text-slate-950 border border-amber-500"
                          >
                            {trip.macro_unit}
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>

                {/* Linha Especial 2: Demandas Indeferidas */}
                <div
                  className="grid bg-rose-50/40 hover:bg-rose-50/70 transition-colors min-h-[58px] border-t border-rose-200"
                  style={ganttGridStyle}
                >
                  <div className="p-2.5 pl-4 flex flex-col justify-center border-r border-rose-200 bg-rose-50/95 sticky left-0 z-20 shadow-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-600 shrink-0"></span>
                      <span className="font-bold text-xs text-rose-950">Demandas Indeferidas</span>
                    </div>
                    <div className="text-[10px] text-rose-800 font-semibold truncate">
                      Não autorizadas
                    </div>
                  </div>

                  {daysInMonth.map((day) => {
                    const dayTrips = trips.filter((t) => {
                      if (t.status !== 'Indeferido') return false;
                      if (t.allocated_driver_id) return false;
                      return isTripOnDay(t, day);
                    });

                    return (
                      <div
                        key={day.toISOString()}
                        className="border-l border-rose-100 p-0.5 relative flex flex-col justify-center gap-1 bg-rose-50/20"
                      >
                        {dayTrips.map((trip) => (
                          <div
                            key={trip.id}
                            onClick={() => onSelectTripDetail(trip)}
                            title={`Processo: ${trip.process_number}\nSituação: Indeferido\nMotivo: ${trip.rejection_reason || 'Não informado'}\nSolicitante: ${trip.requester_name}`}
                            className="w-full rounded p-1 text-[9px] font-bold cursor-pointer truncate shadow-xs transition-transform hover:scale-105 z-10 bg-rose-600 hover:bg-rose-700 text-white border border-rose-700"
                          >
                            {trip.macro_unit}
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>

              </div>

            </div>
          </div>
        </div>
      )}

      {/* VIEW 3: FULL MONTHLY CALENDAR GRID */}
      {viewMode === 'calendar' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-4 space-y-3">
          {/* Day of Week Headers */}
          <div className="grid grid-cols-7 text-center font-bold text-xs text-slate-500 uppercase tracking-wider py-2 border-b border-slate-200">
            <div>Domingo</div>
            <div>Segunda</div>
            <div>Terça</div>
            <div>Quarta</div>
            <div>Quinta</div>
            <div>Sexta</div>
            <div>Sábado</div>
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-1.5">
            {fullCalendarDays.map((day) => {
              const isCurrentMonth = day.getMonth() === currentDate.getMonth();
              const isToday = isSameDay(day, new Date());
              const dayTrips = trips.filter((t) => isTripOnDay(t, day));

              return (
                <div
                  key={day.toISOString()}
                  className={`min-h-[110px] p-2 rounded-xl border flex flex-col justify-between transition-all ${
                    isCurrentMonth ? 'bg-slate-50/70 border-slate-200/80' : 'bg-slate-100/40 border-transparent opacity-40'
                  } ${isToday ? 'ring-2 ring-brand-500 bg-brand-50/30' : ''}`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs font-bold ${
                        isToday
                          ? 'w-6 h-6 rounded-full bg-brand-500 text-white flex items-center justify-center'
                          : 'text-slate-700'
                      }`}
                    >
                      {format(day, 'd')}
                    </span>
                    {dayTrips.length > 0 && (
                      <span className="text-[10px] font-extrabold text-brand-800 bg-brand-100 px-1.5 py-0.2 rounded-full">
                        {dayTrips.length}
                      </span>
                    )}
                  </div>

                  <div className="space-y-1 my-1 overflow-y-auto max-h-[75px]">
                    {dayTrips.map((trip) => {
                      const isConfirmed = trip.status === 'Confirmado ao Demandante';
                      const isPending = trip.status === 'Pendente de Análise';
                      const isRejected = trip.status === 'Indeferido';
                      return (
                        <div
                          key={trip.id}
                          onClick={() => onSelectTripDetail(trip)}
                          className={`p-1 rounded text-[10px] font-semibold cursor-pointer truncate transition-transform hover:scale-102 ${
                            isConfirmed
                              ? 'bg-emerald-100 text-emerald-900 border border-emerald-300 hover:bg-emerald-200'
                              : isRejected
                              ? 'bg-rose-100 text-rose-900 border border-rose-300 hover:bg-rose-200'
                              : isPending
                              ? 'bg-amber-100 text-amber-900 border border-amber-300 hover:bg-amber-200'
                              : 'bg-slate-200 text-slate-800 border border-slate-300 hover:bg-slate-300'
                          }`}
                        >
                          {trip.macro_unit} • {getCityName(trip.destination_city_id)}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
};

export default CalendarView;
