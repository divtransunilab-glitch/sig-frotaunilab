import { 
  TripRequest, 
  FilterOptions, 
  TripStatus, 
  StatusDeadline, 
  RejectionReason, 
  TravelReportStatus 
} from '../types';
import { INITIAL_TRIPS } from '../data/initialData';
import { DistanceService } from './distanceService';
import { ConflictDetector } from './conflictDetector';
import { differenceInDays, differenceInCalendarDays, parseISO } from 'date-fns';
import { supabase } from './supabaseClient';

const STORAGE_KEY_TRIPS = 'sigfrota_trips';

export class TripService {
  private static loadTrips(): TripRequest[] {
    const saved = localStorage.getItem(STORAGE_KEY_TRIPS);
    if (saved) {
      try {
        const parsed: TripRequest[] = JSON.parse(saved);
        return parsed.map((t) => {
          if (t.received_at && t.departure_datetime) {
            const { advanceDays, statusDeadline } = this.calculateDeadline(t.received_at, t.departure_datetime);
            return {
              ...t,
              advance_days: advanceDays,
              status_deadline: statusDeadline,
            };
          }
          return t;
        });
      } catch (e) {
        console.error('Erro ao ler viagens do storage', e);
      }
    }
    localStorage.setItem(STORAGE_KEY_TRIPS, JSON.stringify([]));
    return [];
  }

  static getTrips(filters?: FilterOptions): TripRequest[] {
    let trips = this.loadTrips();

    // Ordenar cronologicamente pela Data da Demanda (departure_datetime)
    trips.sort((a, b) => {
      const timeA = new Date(a.departure_datetime).getTime() || 0;
      const timeB = new Date(b.departure_datetime).getTime() || 0;
      if (timeA !== timeB) return timeA - timeB;
      return a.process_number.localeCompare(b.process_number);
    });

    if (!filters) return trips;

    if (filters.searchTerm && filters.searchTerm.trim() !== '') {
      const term = filters.searchTerm.toLowerCase().trim();
      trips = trips.filter(
        (t) =>
          t.process_number.toLowerCase().includes(term) ||
          t.requester_name.toLowerCase().includes(term) ||
          t.requester_email.toLowerCase().includes(term) ||
          t.macro_unit.toLowerCase().includes(term) ||
          t.requesting_unit.toLowerCase().includes(term)
      );
    }

    if (filters.status && filters.status !== 'ALL') {
      trips = trips.filter((t) => t.status === filters.status);
    }

    if (filters.macro_unit && filters.macro_unit !== 'ALL') {
      trips = trips.filter((t) => t.macro_unit === filters.macro_unit);
    }

    if (filters.activity_type && filters.activity_type !== 'ALL') {
      trips = trips.filter((t) => t.activity_type === filters.activity_type);
    }

    if (filters.status_deadline && filters.status_deadline !== 'ALL') {
      trips = trips.filter((t) => t.status_deadline === filters.status_deadline);
    }

    if (filters.month !== undefined && filters.year !== undefined) {
      trips = trips.filter((t) => {
        const date = parseISO(t.departure_datetime);
        return date.getMonth() === filters.month && date.getFullYear() === filters.year;
      });
    }

    return trips;
  }

  static getTripById(id: string): TripRequest | undefined {
    return this.loadTrips().find((t) => t.id === id);
  }

  static getTripByProcessNumber(processNumber: string): TripRequest | undefined {
    const clean = processNumber.trim().toLowerCase();
    return this.loadTrips().find((t) => t.process_number.trim().toLowerCase() === clean);
  }

  static searchPublicTrips(query: string): TripRequest[] {
    const clean = query.trim().toLowerCase();
    if (!clean) return [];
    return this.loadTrips().filter(
      (t) =>
        t.process_number.toLowerCase().includes(clean) ||
        t.requester_email.toLowerCase().includes(clean)
    );
  }

  /**
   * Calcula antecedência e status de prazo
   */
  static calculateDeadline(receivedAtStr: string, departureStr: string): {
    advanceDays: number;
    statusDeadline: StatusDeadline;
  } {
    const received = new Date(receivedAtStr);
    const departure = new Date(departureStr);
    const advanceDays = Math.max(0, differenceInCalendarDays(departure, received));
    
    // Regra: Mínimo de 5 dias de antecedência para estar "Dentro do Prazo"
    const statusDeadline: StatusDeadline = advanceDays >= 5 ? 'Dentro do Prazo' : 'Fora do Prazo';

    return { advanceDays, statusDeadline };
  }

  /**
   * Salva ou atualiza uma solicitação de viagem
   */
  static saveTrip(tripData: Partial<TripRequest>): TripRequest {
    const trips = this.loadTrips();
    const now = new Date().toISOString();

    let savedTrip: TripRequest;

    if (tripData.id) {
      const idx = trips.findIndex((t) => t.id === tripData.id);
      if (idx === -1) throw new Error('Viagem não encontrada');

      const existingTrip = trips[idx];
      const receivedAt = tripData.received_at || existingTrip.received_at;
      const departure = tripData.departure_datetime || existingTrip.departure_datetime;
      const { advanceDays, statusDeadline } = this.calculateDeadline(receivedAt, departure);

      const origin = tripData.origin_city_id || existingTrip.origin_city_id || 'city-1';
      const destination = tripData.destination_city_id || existingTrip.destination_city_id || 'city-3';
      const estimatedKm = tripData.estimated_km ?? existingTrip.estimated_km ?? DistanceService.calculateTotalKm(origin, destination);

      savedTrip = {
        ...existingTrip,
        ...tripData,
        received_at: receivedAt,
        departure_datetime: departure,
        advance_days: tripData.advance_days ?? advanceDays,
        status_deadline: tripData.status_deadline ?? statusDeadline,
        estimated_km: estimatedKm,
        updated_at: now,
      } as TripRequest;

      trips[idx] = savedTrip;
    } else {
      const receivedAt = tripData.received_at || now;
      const departure = tripData.departure_datetime || now;
      const { advanceDays, statusDeadline } = this.calculateDeadline(receivedAt, departure);

      const origin = tripData.origin_city_id || 'city-1';
      const destination = tripData.destination_city_id || 'city-3';
      const estimatedKm = tripData.estimated_km ?? DistanceService.calculateTotalKm(origin, destination);

      // Gerar número de processo no padrão UNILAB caso não fornecido
      const randomNum = Math.floor(100000 + Math.random() * 900000);
      const processNumber = tripData.process_number || `23282.${randomNum}/2026-${Math.floor(10 + Math.random() * 89)}`;

      savedTrip = {
        id: `trip-${Date.now()}`,
        process_number: processNumber,
        received_at: receivedAt,
        advance_days: advanceDays,
        status_deadline: statusDeadline,
        activity_type: tripData.activity_type || 'Graduação',
        requester_name: tripData.requester_name || '',
        requester_email: tripData.requester_email || '',
        requester_phone: tripData.requester_phone || '',
        macro_unit: tripData.macro_unit || 'IDR',
        requesting_unit: tripData.requesting_unit || '',
        origin_city_id: origin,
        origin_address: tripData.origin_address || '',
        destination_city_id: destination,
        destination_address: tripData.destination_address || '',
        departure_datetime: departure,
        return_datetime: tripData.return_datetime || departure,
        passenger_count: tripData.passenger_count || 1,
        passenger_names: tripData.passenger_names || '',
        trip_objective: tripData.trip_objective || '',
        status: tripData.status || 'Pendente de Análise',
        estimated_km: estimatedKm,
        notes: tripData.notes || '',
        created_at: now,
        updated_at: now,
      };

      trips.unshift(savedTrip);
    }

    localStorage.setItem(STORAGE_KEY_TRIPS, JSON.stringify(trips));

    // Sincronização automática com Supabase
    Promise.resolve(supabase.from('trip_requests').upsert(savedTrip))
      .then((res: any) => {
        if (res?.error) console.warn('Supabase sync trip_requests:', res.error.message);
      })
      .catch((err: any) => {
        console.warn('Supabase sync trip_requests:', err);
      });

    return savedTrip;
  }

  /**
   * Busca todas as solicitações atualizadas diretamente do banco Supabase
   */
  static async fetchFromSupabase(): Promise<TripRequest[]> {
    try {
      const { data, error } = await supabase
        .from('trip_requests')
        .select('*')
        .order('departure_datetime', { ascending: true });

      if (!error && data) {
        localStorage.setItem(STORAGE_KEY_TRIPS, JSON.stringify(data));
        return data as TripRequest[];
      }
    } catch (e) {
      console.warn('Falha ao sincronizar viagens com Supabase:', e);
    }
    return this.getTrips();
  }

  /**
   * Despacha e confirma a solicitação de viagem (com prevenção de overbooking)
   */
  static dispatchTrip(
    tripId: string,
    allocation: {
      contractorId: string;
      driverId: string;
      vehicleId: string;
      notes?: string;
    }
  ): { trip: TripRequest; conflictWarning?: string } {
    const trip = this.getTripById(tripId);
    if (!trip) throw new Error('Solicitação de viagem não encontrada');

    const allTrips = this.loadTrips();

    // Verificação de conflito
    const conflictResult = ConflictDetector.checkConflict(allTrips, {
      tripId,
      driverId: allocation.driverId,
      vehicleId: allocation.vehicleId,
      departureDatetime: trip.departure_datetime,
      returnDatetime: trip.return_datetime,
    });

    const updated = this.saveTrip({
      id: tripId,
      allocated_contractor_id: allocation.contractorId,
      allocated_driver_id: allocation.driverId,
      allocated_vehicle_id: allocation.vehicleId,
      status: 'Confirmado ao Demandante',
      travel_report_status: 'Aguardando Envio da Contratada',
      notes: allocation.notes ? `${trip.notes || ''}\n${allocation.notes}`.trim() : trip.notes,
    });

    return {
      trip: updated,
      conflictWarning: conflictResult.hasConflict ? conflictResult.reason : undefined,
    };
  }

  /**
   * Indefere uma solicitação com motivo estruturado
   */
  static rejectTrip(
    tripId: string,
    data: {
      reason: RejectionReason | string;
      rejection_notes?: string;
    }
  ): TripRequest {
    return this.saveTrip({
      id: tripId,
      status: 'Indeferido',
      rejection_reason: data.reason,
      rejection_notes: data.rejection_notes || '',
      travel_report_status: 'Não Aplicável',
    });
  }

  /**
   * Cancela uma solicitação (pelo demandante ou pela unidade executante)
   */
  static cancelTrip(
    tripId: string,
    options: {
      isExecutante: boolean;
      notes?: string;
    }
  ): TripRequest {
    const status: TripStatus = options.isExecutante
      ? 'Cancelado pela Unidade Executante'
      : 'Cancelado pelo Demandante';

    return this.saveTrip({
      id: tripId,
      status,
      notes: options.notes,
      travel_report_status: 'Não Aplicável',
    });
  }

  /**
   * Altera datas da demanda
   */
  static changeTripDates(
    tripId: string,
    data: {
      departureDatetime: string;
      returnDatetime: string;
      notes?: string;
    }
  ): TripRequest {
    const trip = this.getTripById(tripId);
    if (!trip) throw new Error('Viagem não encontrada');

    return this.saveTrip({
      id: tripId,
      departure_datetime: data.departureDatetime,
      return_datetime: data.returnDatetime,
      status: 'Alterado a Data da Demanda',
      // Resetar alocações para reavaliação de conflitos na nova data
      allocated_driver_id: undefined,
      allocated_vehicle_id: undefined,
      notes: data.notes ? `${trip.notes || ''}\nData alterada: ${data.notes}`.trim() : trip.notes,
    });
  }

  /**
   * Envio de relatório de viagem pós-execução pela Contratada
   */
  static submitTravelReport(
    tripId: string,
    data: {
      real_km: number;
      fuel_liters?: number;
      toll_amount?: number;
      report_notes?: string;
    }
  ): TripRequest {
    return this.saveTrip({
      id: tripId,
      real_km: data.real_km,
      fuel_liters: data.fuel_liters,
      toll_amount: data.toll_amount,
      report_notes: data.report_notes,
      report_submitted_at: new Date().toISOString(),
      travel_report_status: 'Aguardando a Apreciação do Gerente',
    });
  }

  /**
   * Aprovação do relatório de viagem pelo Gerente
   */
  static approveTravelReport(tripId: string): TripRequest {
    return this.saveTrip({
      id: tripId,
      travel_report_status: 'Finalizado no Sistema',
      report_approved_at: new Date().toISOString(),
    });
  }

  /**
   * Retorna métricas analíticas e estatísticas do painel
   */
  static getMetrics(month?: number, year?: number) {
    const allTrips = this.loadTrips();
    const currentMonth = month !== undefined ? month : new Date().getMonth();
    const currentYear = year !== undefined ? year : new Date().getFullYear();

    const monthTrips = allTrips.filter((t) => {
      const d = parseISO(t.departure_datetime);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });

    const totalRequests = monthTrips.length;
    const confirmed = monthTrips.filter((t) => t.status === 'Confirmado ao Demandante').length;
    const pending = monthTrips.filter((t) => t.status === 'Pendente de Análise').length;
    const rejected = monthTrips.filter((t) => t.status === 'Indeferido').length;
    const cancelled = monthTrips.filter(
      (t) => t.status === 'Cancelado pelo Demandante' || t.status === 'Cancelado pela Unidade Executante'
    ).length;

    // Indeferimentos por indisponibilidade
    const rejectedUnavailability = monthTrips.filter(
      (t) =>
        t.status === 'Indeferido' &&
        (t.rejection_reason === 'Indisponibilidade de veículo' ||
          t.rejection_reason === 'Indisponibilidade de veículo e KM')
    ).length;

    const rejectionRate = totalRequests > 0 ? ((rejected / totalRequests) * 100).toFixed(1) : '0.0';
    const unavailabilityRate = totalRequests > 0 ? ((rejectedUnavailability / totalRequests) * 100).toFixed(1) : '0.0';

    // KM Total
    const totalKmEstimated = monthTrips.reduce((acc, t) => acc + (t.estimated_km || 0), 0);
    const totalKmReal = monthTrips.reduce((acc, t) => acc + (t.real_km || t.estimated_km || 0), 0);

    // Fora do prazo
    const outOfDeadline = monthTrips.filter((t) => t.status_deadline === 'Fora do Prazo').length;

    // Por Unidade Macro
    const byMacroUnit: Record<string, number> = {};
    monthTrips.forEach((t) => {
      byMacroUnit[t.macro_unit] = (byMacroUnit[t.macro_unit] || 0) + 1;
    });

    // Por Tipo de Atividade
    const byActivity: Record<string, number> = {};
    monthTrips.forEach((t) => {
      byActivity[t.activity_type] = (byActivity[t.activity_type] || 0) + 1;
    });

    // Por Contratada
    const byContractor: Record<string, number> = {};
    monthTrips.forEach((t) => {
      if (t.allocated_contractor_id) {
        byContractor[t.allocated_contractor_id] = (byContractor[t.allocated_contractor_id] || 0) + 1;
      }
    });

    // Relatórios de viagem pendentes de aprovação
    const pendingReports = allTrips.filter(
      (t) => t.travel_report_status === 'Aguardando a Apreciação do Gerente'
    ).length;

    const waitingContractorReports = allTrips.filter(
      (t) => t.travel_report_status === 'Aguardando Envio da Contratada'
    ).length;

    return {
      totalRequests,
      confirmed,
      pending,
      rejected,
      cancelled,
      outOfDeadline,
      rejectedUnavailability,
      rejectionRate,
      unavailabilityRate,
      totalKmEstimated,
      totalKmReal,
      byMacroUnit,
      byActivity,
      byContractor,
      pendingReports,
      waitingContractorReports,
    };
  }

  /**
   * Substitui todas as viagens pelas novas viagens importadas da planilha
   */
  static replaceTrips(newTrips: TripRequest[]): void {
    localStorage.setItem(STORAGE_KEY_TRIPS, JSON.stringify(newTrips));
  }

  /**
   * Adiciona viagens importadas às já existentes (sem duplicar processo idêntico)
   */
  static appendTrips(incomingTrips: TripRequest[]): void {
    const existing = this.loadTrips();
    const existingProcessSet = new Set(existing.map((t) => t.process_number.trim().toLowerCase()));

    const uniqueNew = incomingTrips.filter(
      (t) => !existingProcessSet.has(t.process_number.trim().toLowerCase())
    );

    const merged = [...uniqueNew, ...existing];
    localStorage.setItem(STORAGE_KEY_TRIPS, JSON.stringify(merged));
  }

  static async clearAllTrips(): Promise<void> {
    localStorage.setItem(STORAGE_KEY_TRIPS, JSON.stringify([]));
    try {
      await supabase.from('trip_requests').delete().neq('id', 'non_existent');
    } catch (e) {
      console.warn('Erro ao limpar trip_requests no Supabase:', e);
    }
  }

  static resetToDefaults(): void {
    localStorage.setItem(STORAGE_KEY_TRIPS, JSON.stringify([]));
  }
}
