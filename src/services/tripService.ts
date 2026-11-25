import { 
  TripRequest, 
  TripLeg,
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
import { GoogleSheetsService } from './googleSheetsService';
import { toTitleCasePtBr } from '../utils/textUtils';
import { generateDriverAccessToken } from '../utils/driverLinkUtils';

const STORAGE_KEY_TRIPS = 'sigfrota_trips';

export class TripService {
  private static pendingSyncPromise: Promise<void> = Promise.resolve();

  /**
   * Filtra e sanitiza apenas as colunas existentes na tabela `trip_requests` do Supabase,
   * removendo campos extras exclusivos do frontend (ex.: intermediate_cities, extra_km)
   * que fariam o PostgREST rejeitar o upsert.
   */
  private static toSupabaseRow(trip: TripRequest, includeExtendedCols = true): Record<string, unknown> {
    const base: Record<string, unknown> = {
      id: trip.id,
      process_number: trip.process_number,
      received_at: trip.received_at,
      advance_days: trip.advance_days ?? 0,
      status_deadline: trip.status_deadline,
      activity_type: trip.activity_type,
      requester_name: trip.requester_name || '',
      requester_email: trip.requester_email || 'solicitante@unilab.edu.br',
      requester_phone: trip.requester_phone || null,
      macro_unit: trip.macro_unit,
      requesting_unit: trip.requesting_unit || '',
      origin_city_id: trip.origin_city_id,
      origin_address: trip.origin_address || null,
      destination_city_id: trip.destination_city_id,
      destination_address: trip.destination_address || null,
      departure_datetime: trip.departure_datetime,
      return_datetime: trip.return_datetime,
      passenger_count: trip.passenger_count ?? 1,
      passenger_names: trip.passenger_names || null,
      passenger_list: trip.passenger_list ?? null,
      trip_objective: trip.trip_objective || null,
      allocated_contractor_id: trip.allocated_contractor_id || null,
      allocated_driver_id: trip.allocated_driver_id || null,
      allocated_vehicle_id: trip.allocated_vehicle_id || null,
      status: trip.status,
      rejection_reason: trip.rejection_reason || null,
      rejection_notes: trip.rejection_notes || null,
      travel_report_status: trip.travel_report_status || null,
      estimated_km: trip.estimated_km ?? 0,
      real_km: trip.real_km ?? null,
      fuel_liters: trip.fuel_liters ?? null,
      toll_amount: trip.toll_amount ?? null,
      report_notes: trip.report_notes || null,
      report_submitted_at: trip.report_submitted_at || null,
      report_approved_at: trip.report_approved_at || null,
      notes: trip.notes || null,
      created_at: trip.created_at,
      updated_at: trip.updated_at,
    };

    if (includeExtendedCols) {
      base.intermediate_cities = trip.intermediate_cities && trip.intermediate_cities.length > 0 ? trip.intermediate_cities : null;
      base.extra_km = trip.extra_km ?? null;
      base.driver_checkin_at = trip.driver_checkin_at || null;
      base.driver_checkout_at = trip.driver_checkout_at || null;
      base.odometer_start = trip.odometer_start ?? null;
      base.odometer_end = trip.odometer_end ?? null;
      base.trip_legs = trip.trip_legs && trip.trip_legs.length > 0 ? trip.trip_legs : null;
      base.driver_access_token = trip.driver_access_token || null;
      base.driver_verified_name = trip.driver_verified_name || null;
      base.driver_verified_at = trip.driver_verified_at || null;
      base.report_approved_by_name = trip.report_approved_by_name || null;
      base.report_approved_by_role = trip.report_approved_by_role || null;
    }

    return base;
  }

  private static loadTrips(): TripRequest[] {
    const saved = localStorage.getItem(STORAGE_KEY_TRIPS);
    if (saved) {
      try {
        const parsed: TripRequest[] = JSON.parse(saved);
        return parsed.map((t) => {
          if (t.received_at && t.departure_datetime) {
            const { advanceDays, statusDeadline } = this.calculateDeadline(t.received_at, t.departure_datetime, t);
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
   * Calcula antecedência e status de prazo segundo as normas oficiais da Portaria PROADI:
   * - Transporte Coletivo de Discentes (Graduação/Pós ou PAX > 4): Mínimo 7 dias de antecedência.
   * - Demais Solicitações (Padrão / 72h úteis): Mínimo 3 dias de antecedência.
   */
  static calculateDeadline(
    receivedAtStr: string, 
    departureStr: string,
    tripDetails?: Partial<TripRequest>
  ): {
    advanceDays: number;
    requiredDays: number;
    statusDeadline: StatusDeadline;
  } {
    const received = parseISO(receivedAtStr);
    const departure = parseISO(departureStr);
    const advanceDays = Math.max(0, differenceInCalendarDays(departure, received));
    
    // Identifica se é transporte coletivo de discentes (estudantes)
    const pax = tripDetails?.passenger_count ?? 1;
    const act = (tripDetails?.activity_type || '').toString();
    const obj = (tripDetails?.trip_objective || '').toString().toLowerCase();

    const isStudentCollective = 
      pax > 4 || 
      (pax > 1 && (act === 'Graduação' || act === 'Pós Graduação')) ||
      obj.includes('discente') || 
      obj.includes('aluno') || 
      obj.includes('estudante') || 
      obj.includes('aula de campo');

    // Regra da Portaria PROADI: 7 dias para transporte coletivo de discentes, 3 dias (72h úteis) para demais solicitações
    const requiredDays = isStudentCollective ? 7 : 3;
    const statusDeadline: StatusDeadline = advanceDays >= requiredDays ? 'Dentro do Prazo' : 'Fora do Prazo';

    return { advanceDays, requiredDays, statusDeadline };
  }

  /**
   * Salva ou atualiza uma solicitação de viagem
   */
  static saveTrip(rawTripData: Partial<TripRequest>): TripRequest {
    // Padroniza textos que vieram todos em MAIÚSCULAS para Title Case (primeira letra maiúscula de cada palavra)
    const tripData: Partial<TripRequest> = {
      ...rawTripData,
      ...(rawTripData.requester_name !== undefined
        ? { requester_name: toTitleCasePtBr(rawTripData.requester_name, true) }
        : {}),
      ...(rawTripData.requesting_unit !== undefined
        ? { requesting_unit: toTitleCasePtBr(rawTripData.requesting_unit, true) }
        : {}),
      ...(rawTripData.origin_address !== undefined
        ? { origin_address: toTitleCasePtBr(rawTripData.origin_address, true) }
        : {}),
      ...(rawTripData.destination_address !== undefined
        ? { destination_address: toTitleCasePtBr(rawTripData.destination_address, true) }
        : {}),
      ...(rawTripData.trip_objective !== undefined
        ? { trip_objective: toTitleCasePtBr(rawTripData.trip_objective, true) }
        : {}),
      ...(rawTripData.passenger_names !== undefined
        ? { passenger_names: toTitleCasePtBr(rawTripData.passenger_names, true) }
        : {}),
    };

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

      // Gera ou rotaciona o token único do motorista sempre que o motorista escalado for atribuído ou alterado
      const nextDriverId =
        tripData.allocated_driver_id !== undefined
          ? tripData.allocated_driver_id
          : existingTrip.allocated_driver_id;
      const driverChanged =
        tripData.allocated_driver_id !== undefined &&
        tripData.allocated_driver_id !== existingTrip.allocated_driver_id;
      const nextDriverToken = nextDriverId
        ? driverChanged || !existingTrip.driver_access_token
          ? generateDriverAccessToken()
          : existingTrip.driver_access_token
        : undefined;

      savedTrip = {
        ...existingTrip,
        ...tripData,
        driver_access_token: tripData.driver_access_token ?? nextDriverToken,
        received_at: receivedAt,
        departure_datetime: departure,
        advance_days: advanceDays,
        status_deadline: statusDeadline,
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
        intermediate_cities: tripData.intermediate_cities,
        extra_km: tripData.extra_km,
        allocated_contractor_id: tripData.allocated_contractor_id,
        allocated_driver_id: tripData.allocated_driver_id,
        allocated_vehicle_id: tripData.allocated_vehicle_id,
        driver_access_token:
          tripData.driver_access_token ||
          (tripData.allocated_driver_id ? generateDriverAccessToken() : undefined),
        travel_report_status: tripData.travel_report_status,
        notes: tripData.notes || '',
        created_at: now,
        updated_at: now,
      };

      trips.unshift(savedTrip);
    }

    localStorage.setItem(STORAGE_KEY_TRIPS, JSON.stringify(trips));

    // Sincronização automática com Supabase (encadeada para evitar race condition com fetchFromSupabase)
    // Trata automaticamente:
    // 1) PGRST204 (colunas intermediate_cities/extra_km ainda não criadas) -> fallback sem essas colunas
    // 2) 23505 (process_number duplicado pela constraint unique) -> adiciona sufixo (2), (3)... para nunca perder o cadastro
    const fullPayload = this.toSupabaseRow(savedTrip, true);
    const basePayload = this.toSupabaseRow(savedTrip, false);
    this.pendingSyncPromise = this.pendingSyncPromise.then(async () => {
      try {
        let res: any = await supabase.from('trip_requests').upsert(fullPayload);

        if (res?.error) {
          const msg = String(res.error.message || '');
          if (
            msg.includes('intermediate_cities') ||
            msg.includes('extra_km') ||
            msg.includes('driver_checkin_at') ||
            msg.includes('odometer_start') ||
            msg.includes('trip_legs') ||
            msg.includes('driver_access_token') ||
            msg.includes('driver_verified_name') ||
            msg.includes('report_approved_by_name') ||
            res.error.code === 'PGRST204'
          ) {
            res = await supabase.from('trip_requests').upsert(basePayload);
          }
        }

        // Se o banco ainda tiver constraint UNIQUE em process_number (23505), garante persistência com sufixo (2), (3)...
        if (res?.error && (res.error.code === '23505' || String(res.error.message || '').includes('process_number'))) {
          const originalProc = savedTrip.process_number;
          let persisted = false;
          for (let attempt = 2; attempt <= 20; attempt++) {
            const suffixedProc = `${originalProc} (${attempt})`;
            const retryFull = { ...fullPayload, process_number: suffixedProc };
            const retryBase = { ...basePayload, process_number: suffixedProc };
            let retryRes: any = await supabase.from('trip_requests').upsert(retryFull);
            if (retryRes?.error && (retryRes.error.code === 'PGRST204' || String(retryRes.error.message || '').includes('intermediate_cities'))) {
              retryRes = await supabase.from('trip_requests').upsert(retryBase);
            }
            if (!retryRes?.error) {
              // Atualiza no localStorage para refletir o número salvo no banco
              const currentTrips = this.loadTrips();
              const targetIdx = currentTrips.findIndex((t) => t.id === savedTrip.id);
              if (targetIdx !== -1) {
                currentTrips[targetIdx] = { ...currentTrips[targetIdx], process_number: suffixedProc };
                localStorage.setItem(STORAGE_KEY_TRIPS, JSON.stringify(currentTrips));
              }
              try {
                window.dispatchEvent(
                  new CustomEvent('sigfrota:trip-sync-notice', {
                    detail: {
                      type: 'warning',
                      tripId: savedTrip.id,
                      newProcessNumber: suffixedProc,
                      message: `O processo "${originalProc}" já existia no banco; salvo como "${suffixedProc}" para não sobrescrever nem perder o cadastro.`,
                    },
                  })
                );
              } catch {
                // ignore
              }
              persisted = true;
              break;
            }
          }
          if (!persisted) {
            console.error('Supabase sync trip_requests duplicate error:', res.error.message);
          }
        } else if (res?.error) {
          console.error('Supabase sync trip_requests error:', res.error.message, res.error);
          try {
            window.dispatchEvent(
              new CustomEvent('sigfrota:trip-sync-notice', {
                detail: {
                  type: 'warning',
                  message: `Aviso: falha ao salvar no banco Supabase (${res.error.message}).`,
                },
              })
            );
          } catch {
            // ignore
          }
        }
      } catch (err: any) {
        console.error('Supabase sync trip_requests exception:', err);
      }
    });

    // Backup automático no Google Sheets (não bloqueante)
    GoogleSheetsService.syncTripToSheets(savedTrip, tripData.id ? 'update' : 'create').catch((err) => {
      console.warn('Google Sheets backup sync:', err);
    });

    return savedTrip;
  }

  /**
   * Busca todas as solicitações atualizadas diretamente do banco Supabase
   */
  static async fetchFromSupabase(): Promise<TripRequest[]> {
    try {
      // Aguarda qualquer gravação pendente terminar antes de consultar o Supabase
      await this.pendingSyncPromise;

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
      reason?: string;
      notes?: string;
    }
  ): TripRequest {
    const status: TripStatus = options.isExecutante
      ? 'Cancelado pela Unidade Executante'
      : 'Cancelado pelo Demandante';

    const combinedNotes = [
      options.reason ? `Motivo do cancelamento: ${options.reason}` : '',
      options.notes ? options.notes.trim() : '',
    ]
      .filter(Boolean)
      .join(' — ');

    return this.saveTrip({
      id: tripId,
      status,
      rejection_reason: (options.reason as any) || undefined,
      rejection_notes: options.notes?.trim() || undefined,
      notes: combinedNotes || undefined,
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
   * Envio ou edição de relatório de viagem pós-execução (Contratada / Motorista / Gerente)
   */
  static submitTravelReport(
    tripId: string,
    data: {
      real_km: number;
      odometer_start?: number;
      odometer_end?: number;
      trip_legs?: TripLeg[];
      fuel_liters?: number;
      toll_amount?: number;
      report_notes?: string;
      preserveFinalizedStatus?: boolean;
    }
  ): TripRequest {
    const existing = this.getTripById(tripId);
    const keepFinalized =
      data.preserveFinalizedStatus && existing?.travel_report_status === 'Finalizado no Sistema';

    return this.saveTrip({
      id: tripId,
      real_km: data.real_km,
      ...(data.odometer_start !== undefined ? { odometer_start: data.odometer_start } : {}),
      ...(data.odometer_end !== undefined ? { odometer_end: data.odometer_end } : {}),
      ...(data.trip_legs !== undefined ? { trip_legs: data.trip_legs } : {}),
      fuel_liters: data.fuel_liters,
      toll_amount: data.toll_amount,
      report_notes: data.report_notes,
      report_submitted_at: existing?.report_submitted_at || new Date().toISOString(),
      travel_report_status: keepFinalized
        ? 'Finalizado no Sistema'
        : 'Aguardando a Apreciação do Gerente',
    });
  }

  /**
   * Aprovação / Homologação do relatório de viagem pelo Gerente (registrando Nome e Cargo)
   */
  static approveTravelReport(
    tripId: string,
    approver?: { name?: string; role?: string }
  ): TripRequest {
    return this.saveTrip({
      id: tripId,
      travel_report_status: 'Finalizado no Sistema',
      report_approved_at: new Date().toISOString(),
      ...(approver?.name ? { report_approved_by_name: approver.name.trim() } : {}),
      ...(approver?.role ? { report_approved_by_role: approver.role.trim() } : {}),
    });
  }

  /**
   * Busca dados anonimizados para o Painel de Transparência via RPC segura (LGPD)
   * com fallback automático caso a migração de blindagem ainda não tenha sido executada.
   */
  static async fetchPublicTransparencyTrips(): Promise<TripRequest[]> {
    try {
      const { data, error } = await supabase.rpc('get_public_transparency_trips');
      if (!error && Array.isArray(data)) {
        return data as TripRequest[];
      }
    } catch (e) {
      console.warn('RPC get_public_transparency_trips indisponível, usando fallback:', e);
    }
    return this.fetchFromSupabase();
  }

  /**
   * Busca pública de processo via RPC segura (sem expor tokens, CNH ou PIN)
   * com fallback local/padrão caso a RPC ainda não exista no banco.
   */
  static async searchPublicTripsAsync(query: string): Promise<Array<TripRequest & { driver_public_name?: string }>> {
    const clean = query.trim();
    if (clean.length < 2) return [];

    try {
      const { data, error } = await supabase.rpc('search_public_trip', { p_query: clean });
      if (!error && Array.isArray(data)) {
        return data as Array<TripRequest & { driver_public_name?: string }>;
      }
    } catch (e) {
      console.warn('RPC search_public_trip indisponível, usando busca local:', e);
    }

    return this.searchPublicTrips(clean);
  }

  /**
   * Carrega a Ordem Digital do Motorista via RPC segura (valida token no servidor e nunca expõe PIN/CNH)
   * com fallback automático caso a migração ainda não tenha sido executada.
   */
  static async fetchDriverOrderSecure(
    tripId: string,
    accessToken?: string | null
  ): Promise<{
    status: 'ok' | 'not_found' | 'invalid_token';
    trip?: TripRequest;
    vehicle?: any;
    driver?: {
      id: string;
      name: string;
      cnh_category?: string;
      driver_category?: string;
      requires_code: boolean;
      has_pin?: boolean;
      has_cnh?: boolean;
      has_phone?: boolean;
    } | null;
    usedSecureRpc: boolean;
  }> {
    try {
      const { data, error } = await supabase.rpc('get_driver_order_public', {
        p_trip_id: tripId,
        p_access_token: accessToken || null,
      });

      if (!error && data && typeof data === 'object' && 'status' in data) {
        const res = data as any;
        if (res.status === 'invalid_token') return { status: 'invalid_token', usedSecureRpc: true };
        if (res.status === 'not_found') return { status: 'not_found', usedSecureRpc: true };
        if (res.status === 'ok' && res.trip) {
          return {
            status: 'ok',
            trip: res.trip as TripRequest,
            vehicle: res.vehicle || undefined,
            driver: res.driver || null,
            usedSecureRpc: true,
          };
        }
      }
    } catch (e) {
      console.warn('RPC get_driver_order_public indisponível, usando fallback:', e);
    }

    // Fallback para bancos antes da migração de blindagem
    const fallbackTrip = await this.fetchTripByIdPublic(tripId);
    if (!fallbackTrip) return { status: 'not_found', usedSecureRpc: false };
    return { status: 'ok', trip: fallbackTrip, usedSecureRpc: false };
  }

  /**
   * Valida o código de 4 dígitos do motorista 100% no servidor (PIN/CNH/Telefone nunca sai do banco)
   */
  static async verifyDriverCodeServer(
    tripId: string,
    accessToken: string | null,
    driverCode: string
  ): Promise<{ valid: boolean; driverName?: string; error?: string; usedSecureRpc: boolean }> {
    try {
      const { data, error } = await supabase.rpc('verify_driver_identity', {
        p_trip_id: tripId,
        p_access_token: accessToken || null,
        p_driver_code: driverCode,
      });

      if (!error && data && typeof data === 'object' && 'valid' in data) {
        const res = data as any;
        return {
          valid: Boolean(res.valid),
          driverName: res.driver_name,
          error: res.error,
          usedSecureRpc: true,
        };
      }
    } catch (e) {
      console.warn('RPC verify_driver_identity indisponível, usando fallback:', e);
    }

    return { valid: false, usedSecureRpc: false };
  }

  /**
   * Busca uma viagem específica diretamente no Supabase (para link/QR Code do motorista)
   * com fallback automático para o cache local.
   */
  static async fetchTripByIdPublic(tripId: string): Promise<TripRequest | null> {
    try {
      await this.pendingSyncPromise;
      const { data, error } = await supabase
        .from('trip_requests')
        .select('*')
        .eq('id', tripId)
        .maybeSingle();

      if (!error && data) {
        const fetched = data as TripRequest;
        const local = this.loadTrips();
        const existingIdx = local.findIndex((t) => t.id === fetched.id);
        const existing = existingIdx !== -1 ? local[existingIdx] : undefined;
        const merged: TripRequest = {
          ...(existing || {}),
          ...fetched,
          passenger_names: fetched.passenger_names || existing?.passenger_names,
          passenger_list:
            fetched.passenger_list && fetched.passenger_list.length > 0
              ? fetched.passenger_list
              : existing?.passenger_list,
          trip_legs:
            Array.isArray(fetched.trip_legs) && fetched.trip_legs.length > 0
              ? fetched.trip_legs
              : existing?.trip_legs,
        };
        if (existingIdx !== -1) {
          local[existingIdx] = merged;
        } else {
          local.push(merged);
        }
        localStorage.setItem(STORAGE_KEY_TRIPS, JSON.stringify(local));
        return merged;
      }
    } catch (e) {
      console.warn('Falha ao buscar viagem pública no Supabase:', e);
    }

    return this.getTripById(tripId) || null;
  }

  /**
   * Registro de Check-in (Saída) pelo Motorista via Ordem de Tráfego Digital (Mobile)
   */
  static async submitDriverCheckIn(
    tripId: string,
    data: {
      odometer_start: number;
      checkin_at?: string;
      notes?: string;
      trip_legs?: TripLeg[];
      access_token?: string;
      driver_code?: string;
      verified_name?: string;
    }
  ): Promise<{ trip: TripRequest | null; syncedToCloud: boolean; warning?: string }> {
    const timestamp = data.checkin_at || new Date().toISOString();

    try {
      let rpcRes = await supabase.rpc('driver_update_trip_execution', {
        p_trip_id: tripId,
        p_action: 'checkin',
        p_odometer_start: data.odometer_start,
        p_report_notes: data.notes || null,
        p_event_timestamp: timestamp,
        p_trip_legs: data.trip_legs && data.trip_legs.length > 0 ? data.trip_legs : null,
        p_access_token: data.access_token || null,
        p_driver_code: data.driver_code || null,
      });

      // Fallback caso o banco ainda esteja com a assinatura anterior da RPC
      if (
        rpcRes.error &&
        (String(rpcRes.error.message || '').includes('p_access_token') ||
          String(rpcRes.error.message || '').includes('p_driver_code') ||
          String(rpcRes.error.message || '').includes('p_trip_legs'))
      ) {
        rpcRes = await supabase.rpc('driver_update_trip_execution', {
          p_trip_id: tripId,
          p_action: 'checkin',
          p_odometer_start: data.odometer_start,
          p_report_notes: data.notes || null,
          p_event_timestamp: timestamp,
        });
      }

      if (!rpcRes.error && rpcRes.data) {
        const updated: TripRequest = {
          ...(rpcRes.data as TripRequest),
          trip_legs:
            (rpcRes.data as TripRequest).trip_legs ||
            (data.trip_legs && data.trip_legs.length > 0 ? data.trip_legs : undefined),
          driver_verified_name:
            (rpcRes.data as TripRequest).driver_verified_name || data.verified_name,
          driver_verified_at:
            (rpcRes.data as TripRequest).driver_verified_at || timestamp,
        };
        const local = this.loadTrips();
        const idx = local.findIndex((t) => t.id === updated.id);
        if (idx !== -1) local[idx] = { ...local[idx], ...updated };
        else local.push(updated);
        localStorage.setItem(STORAGE_KEY_TRIPS, JSON.stringify(local));
        return { trip: updated, syncedToCloud: true };
      }

      if (rpcRes.error) {
        const errMsg = String(rpcRes.error.message || '');
        if (
          errMsg.includes('Link revogado') ||
          errMsg.includes('Código de identificação inválido') ||
          errMsg.includes('já foi homologada')
        ) {
          return { trip: null, syncedToCloud: false, warning: errMsg };
        }
        console.warn('RPC driver_update_trip_execution indisponível ou recusada:', errMsg);
      }
    } catch (err) {
      console.warn('Erro ao chamar RPC de check-in do motorista:', err);
    }

    // Fallback: se o dispositivo estiver autenticado ou offline, atualiza localmente e tenta sync padrão
    const existing = this.getTripById(tripId);
    if (!existing) {
      return {
        trip: null,
        syncedToCloud: false,
        warning: 'Não foi possível localizar a viagem para registrar a saída.',
      };
    }

    const saved = this.saveTrip({
      id: tripId,
      driver_checkin_at: timestamp,
      odometer_start: data.odometer_start,
      trip_legs: data.trip_legs,
      driver_verified_name: data.verified_name || existing.driver_verified_name,
      driver_verified_at: existing.driver_verified_at || timestamp,
      report_notes: data.notes ? data.notes : existing.report_notes,
    });

    return {
      trip: saved,
      syncedToCloud: false,
      warning:
        'Check-in salvo neste aparelho. Para sincronização automática sem login no servidor, execute a migração SQL do módulo do motorista no Supabase.',
    };
  }

  /**
   * Registro de Check-out (Retorno + Relatório Pós-Viagem por Trecho) pelo Motorista via Mobile
   */
  static async submitDriverCheckOut(
    tripId: string,
    data: {
      odometer_start?: number;
      odometer_end: number;
      real_km: number;
      checkout_at?: string;
      fuel_liters?: number;
      toll_amount?: number;
      report_notes?: string;
      trip_legs?: TripLeg[];
      access_token?: string;
      driver_code?: string;
      verified_name?: string;
    }
  ): Promise<{ trip: TripRequest | null; syncedToCloud: boolean; warning?: string }> {
    const timestamp = data.checkout_at || new Date().toISOString();

    try {
      let rpcRes = await supabase.rpc('driver_update_trip_execution', {
        p_trip_id: tripId,
        p_action: 'checkout',
        p_odometer_start: data.odometer_start ?? null,
        p_odometer_end: data.odometer_end,
        p_real_km: data.real_km,
        p_fuel_liters: data.fuel_liters ?? null,
        p_toll_amount: data.toll_amount ?? null,
        p_report_notes: data.report_notes || null,
        p_event_timestamp: timestamp,
        p_trip_legs: data.trip_legs && data.trip_legs.length > 0 ? data.trip_legs : null,
        p_access_token: data.access_token || null,
        p_driver_code: data.driver_code || null,
      });

      // Fallback caso o banco ainda esteja com a assinatura anterior da RPC
      if (
        rpcRes.error &&
        (String(rpcRes.error.message || '').includes('p_access_token') ||
          String(rpcRes.error.message || '').includes('p_driver_code') ||
          String(rpcRes.error.message || '').includes('p_trip_legs'))
      ) {
        rpcRes = await supabase.rpc('driver_update_trip_execution', {
          p_trip_id: tripId,
          p_action: 'checkout',
          p_odometer_start: data.odometer_start ?? null,
          p_odometer_end: data.odometer_end,
          p_real_km: data.real_km,
          p_fuel_liters: data.fuel_liters ?? null,
          p_toll_amount: data.toll_amount ?? null,
          p_report_notes: data.report_notes || null,
          p_event_timestamp: timestamp,
        });
      }

      if (!rpcRes.error && rpcRes.data) {
        const updated: TripRequest = {
          ...(rpcRes.data as TripRequest),
          trip_legs:
            (rpcRes.data as TripRequest).trip_legs ||
            (data.trip_legs && data.trip_legs.length > 0 ? data.trip_legs : undefined),
          driver_verified_name:
            (rpcRes.data as TripRequest).driver_verified_name || data.verified_name,
          driver_verified_at:
            (rpcRes.data as TripRequest).driver_verified_at || timestamp,
        };
        const local = this.loadTrips();
        const idx = local.findIndex((t) => t.id === updated.id);
        if (idx !== -1) local[idx] = { ...local[idx], ...updated };
        else local.push(updated);
        localStorage.setItem(STORAGE_KEY_TRIPS, JSON.stringify(local));
        GoogleSheetsService.syncTripToSheets(updated, 'update').catch(() => {});
        return { trip: updated, syncedToCloud: true };
      }

      if (rpcRes.error) {
        const errMsg = String(rpcRes.error.message || '');
        if (
          errMsg.includes('Link revogado') ||
          errMsg.includes('Código de identificação inválido') ||
          errMsg.includes('já foi homologada')
        ) {
          return { trip: null, syncedToCloud: false, warning: errMsg };
        }
        console.warn('RPC driver_update_trip_execution (checkout) falhou:', errMsg);
      }
    } catch (err) {
      console.warn('Erro ao chamar RPC de check-out do motorista:', err);
    }

    // Fallback local + sync padrão
    const existing = this.getTripById(tripId);
    if (!existing) {
      return {
        trip: null,
        syncedToCloud: false,
        warning: 'Não foi possível localizar a viagem para finalizar o relatório.',
      };
    }

    const saved = this.saveTrip({
      id: tripId,
      driver_checkin_at: existing.driver_checkin_at || timestamp,
      driver_checkout_at: timestamp,
      odometer_start: data.odometer_start ?? existing.odometer_start,
      odometer_end: data.odometer_end,
      trip_legs: data.trip_legs,
      driver_verified_name: data.verified_name || existing.driver_verified_name,
      driver_verified_at: existing.driver_verified_at || timestamp,
      real_km: data.real_km,
      fuel_liters: data.fuel_liters,
      toll_amount: data.toll_amount,
      report_notes: data.report_notes,
      report_submitted_at: timestamp,
      travel_report_status: 'Aguardando a Apreciação do Gerente',
    });

    return {
      trip: saved,
      syncedToCloud: false,
      warning:
        'Relatório salvo neste aparelho. Para sincronizar automaticamente sem login no servidor, execute a migração SQL do módulo do motorista no Supabase.',
    };
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
   * Sincroniza viagens em lote para o banco de dados Supabase
   */
  static async syncTripsToSupabase(trips: TripRequest[]): Promise<void> {
    try {
      if (!trips || trips.length === 0) return;

      // Manter controle de números de processo para evitar colisão de UNIQUE constraint no Supabase
      const seenProcessNumbers = new Set<string>();

      const sanitized = trips.map((t, idx) => {
        let rawProcess = (t.process_number || `PROC-${Date.now()}-${idx}`).trim();
        if (rawProcess.length > 45) {
          rawProcess = rawProcess.substring(0, 45);
        }
        let finalProcess = rawProcess;
        let dupCount = 1;
        while (seenProcessNumbers.has(finalProcess.toLowerCase())) {
          dupCount++;
          finalProcess = `${rawProcess}-${dupCount}`;
        }
        seenProcessNumbers.add(finalProcess.toLowerCase());

        const validStatuses = [
          'Confirmado ao Demandante',
          'Indeferido',
          'Cancelado pelo Demandante',
          'Cancelado pela Unidade Executante',
          'Alterado a Data da Demanda',
          'Pendente de Análise'
        ];
        const status = validStatuses.includes(t.status) ? t.status : 'Pendente de Análise';

        const validDeadlines = ['Dentro do Prazo', 'Fora do Prazo'];
        const status_deadline = validDeadlines.includes(t.status_deadline) ? t.status_deadline : 'Dentro do Prazo';

        const validActivities = ['Graduação', 'Pós Graduação', 'Pesquisa', 'Extensão', 'Administrativo'];
        const activity_type = validActivities.includes(t.activity_type) ? t.activity_type : 'Graduação';

        const validReportStatuses = ['Finalizado no Sistema', 'Aguardando Envio da Contratada', 'Aguardando a Apreciação do Gerente', 'Não Aplicável'];
        const travel_report_status = validReportStatuses.includes(t.travel_report_status || '') ? t.travel_report_status : 'Não Aplicável';

        return {
          ...t,
          id: t.id || `trip-imp-${Date.now()}-${idx}`,
          process_number: finalProcess,
          status_deadline,
          activity_type,
          requester_name: t.requester_name || 'Solicitante Institucional',
          requester_email: t.requester_email || 'solicitante@unilab.edu.br',
          macro_unit: t.macro_unit || 'IDR',
          requesting_unit: t.requesting_unit || 'Unidade Solicitante',
          origin_city_id: t.origin_city_id || 'city-71',
          destination_city_id: t.destination_city_id || 'city-27',
          departure_datetime: t.departure_datetime || new Date().toISOString(),
          return_datetime: t.return_datetime || new Date().toISOString(),
          passenger_count: Math.max(1, Number(t.passenger_count) || 1),
          estimated_km: Math.max(0, Number(t.estimated_km) || 0),
          status,
          travel_report_status,
          received_at: t.received_at || new Date().toISOString(),
          allocated_contractor_id: t.allocated_contractor_id || null,
          allocated_driver_id: t.allocated_driver_id || null,
          allocated_vehicle_id: t.allocated_vehicle_id || null,
        };
      });

      const BATCH_SIZE = 50;
      for (let i = 0; i < sanitized.length; i += BATCH_SIZE) {
        const batch = sanitized.slice(i, i + BATCH_SIZE);
        const { error } = await supabase.from('trip_requests').upsert(batch);
        if (error) {
          console.error(`Erro ao enviar lote ${Math.floor(i / BATCH_SIZE) + 1} para o Supabase:`, error.message);
          // Tenta envio individual item a item caso o lote completo sofra rejeição
          for (const item of batch) {
            const { error: singleErr } = await supabase.from('trip_requests').upsert(item);
            if (singleErr) {
              console.warn(`Aviso no envio do processo ${item.process_number}:`, singleErr.message);
            }
          }
        }
      }
    } catch (e) {
      console.warn('Erro ao sincronizar viagens com Supabase:', e);
    }
  }

  /**
   * Substitui todas as viagens pelas novas viagens importadas da planilha
   */
  static async replaceTrips(newTrips: TripRequest[]): Promise<void> {
    localStorage.setItem(STORAGE_KEY_TRIPS, JSON.stringify(newTrips));
    try {
      await supabase.from('trip_requests').delete().neq('id', 'non_existent');
      await this.syncTripsToSupabase(newTrips);
    } catch (e) {
      console.warn('Erro ao substituir viagens no Supabase:', e);
    }
  }

  /**
   * Adiciona viagens importadas às já existentes (sem duplicar processo idêntico)
   */
  static async appendTrips(incomingTrips: TripRequest[]): Promise<void> {
    const existing = this.loadTrips();
    const existingProcessSet = new Set(existing.map((t) => t.process_number.trim().toLowerCase()));

    const uniqueNew = incomingTrips.filter(
      (t) => !existingProcessSet.has(t.process_number.trim().toLowerCase())
    );

    const merged = [...uniqueNew, ...existing];
    localStorage.setItem(STORAGE_KEY_TRIPS, JSON.stringify(merged));
    await this.syncTripsToSupabase(uniqueNew);
  }

  static async deleteTrip(tripId: string): Promise<boolean> {
    const existing = this.loadTrips();
    const updated = existing.filter((t) => t.id !== tripId);
    localStorage.setItem(STORAGE_KEY_TRIPS, JSON.stringify(updated));
    try {
      await supabase.from('trip_requests').delete().eq('id', tripId);
    } catch (e) {
      console.warn('Erro ao excluir solicitação no Supabase:', e);
    }
    return true;
  }

  static async clearAllTrips(): Promise<void> {
    localStorage.setItem(STORAGE_KEY_TRIPS, JSON.stringify([]));
    try {
      await supabase.from('trip_requests').delete().neq('id', 'non_existent');
    } catch (e) {
      console.warn('Erro ao limpar trip_requests no Supabase:', e);
    }
  }

  /**
   * Solicita o envio do link exclusivo de avaliação para o e-mail cadastrado na solicitação (máx. 3 envios).
   * O envio é feito pelo servidor (/api/send-rating-link) sem expor o e-mail real nem o token ao navegador.
   */
  static async requestPublicRatingEmailLink(
    tripId: string,
    processNumber: string
  ): Promise<{
    ok: boolean;
    maskedEmail?: string;
    sentCount?: number;
    remainingSends?: number;
    limitReached?: boolean;
    error?: string;
  }> {
    try {
      const response = await fetch('/api/send-rating-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tripId, processNumber }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.ok) {
        return {
          ok: false,
          limitReached: Boolean(data?.limit_reached),
          sentCount: typeof data?.sent_count === 'number' ? data.sent_count : undefined,
          error: data?.error || 'Não foi possível enviar o link de avaliação por e-mail.',
        };
      }

      return {
        ok: true,
        maskedEmail: data.masked_email,
        sentCount: data.sent_count,
        remainingSends: data.remaining_sends,
      };
    } catch {
      return {
        ok: false,
        error: 'Erro de conexão com o servidor de envio de e-mail.',
      };
    }
  }

  /**
   * Carrega os dados seguros de uma viagem para a página exclusiva de avaliação (?avaliar=<id>&rt=<token>)
   */
  static async fetchTripForRating(
    tripId: string,
    ratingToken: string
  ): Promise<{
    status: 'ok' | 'already_rated' | 'invalid_token' | 'not_found' | 'error';
    trip?: Partial<TripRequest> & { driver_public_name?: string };
  }> {
    try {
      const { data, error } = await supabase.rpc('get_trip_for_rating', {
        p_trip_id: tripId,
        p_rating_token: ratingToken,
      });

      if (error || !data || typeof data !== 'object') {
        return { status: 'error' };
      }

      const res = data as any;
      if (res.status === 'ok' || res.status === 'already_rated') {
        return { status: res.status, trip: res.trip };
      }
      if (res.status === 'invalid_token' || res.status === 'not_found') {
        return { status: res.status };
      }
      return { status: 'error' };
    } catch {
      return { status: 'error' };
    }
  }

  /**
   * Envia avaliação de satisfação da viagem exigindo o token exclusivo recebido por e-mail
   */
  static async submitPublicTripRating(params: {
    tripId: string;
    ratingToken: string;
    punctuality: number;
    vehicle: number;
    driver: number;
    comment?: string;
    raterName?: string;
  }): Promise<{
    ok: boolean;
    error?: string;
    rating?: {
      rating_overall: number;
      rating_punctuality: number;
      rating_vehicle: number;
      rating_driver: number;
      rating_comment?: string;
      rated_at: string;
    };
  }> {
    try {
      const { data, error } = await supabase.rpc('submit_public_trip_rating', {
        p_trip_id: params.tripId,
        p_rating_token: params.ratingToken,
        p_punctuality: params.punctuality,
        p_vehicle: params.vehicle,
        p_driver: params.driver,
        p_comment: params.comment?.trim() || null,
        p_rater_name: params.raterName?.trim() || null,
      });

      if (error) {
        return {
          ok: false,
          error:
            error.message?.includes('submit_public_trip_rating')
              ? 'A avaliação pública ainda precisa ser ativada no banco (migração SQL pendente).'
              : error.message || 'Não foi possível registrar sua avaliação.',
        };
      }

      const res = data as any;
      if (!res || !res.ok) {
        return { ok: false, error: res?.error || 'Não foi possível registrar sua avaliação.' };
      }

      const ratingPayload = {
        rating_overall: Number(res.rating_overall),
        rating_punctuality: Number(res.rating_punctuality),
        rating_vehicle: Number(res.rating_vehicle),
        rating_driver: Number(res.rating_driver),
        rating_comment: res.rating_comment || undefined,
        rated_at: res.rated_at || new Date().toISOString(),
      };

      const local = this.loadTrips();
      const idx = local.findIndex((t) => t.id === params.tripId);
      if (idx !== -1) {
        local[idx] = { ...local[idx], ...ratingPayload };
        localStorage.setItem(STORAGE_KEY_TRIPS, JSON.stringify(local));
      }

      return { ok: true, rating: ratingPayload };
    } catch (e: any) {
      return { ok: false, error: e?.message || 'Erro de conexão ao enviar avaliação.' };
    }
  }

  static resetToDefaults(): void {
    localStorage.setItem(STORAGE_KEY_TRIPS, JSON.stringify([]));
  }
}
