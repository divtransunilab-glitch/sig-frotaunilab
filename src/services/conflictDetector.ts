import { TripRequest, ConflictCheckResult } from '../types';

export class ConflictDetector {
  /**
   * Verifica se há conflito de agenda (overbooking) para o motorista ou veículo selecionado
   */
  static checkConflict(
    allTrips: TripRequest[],
    candidate: {
      tripId?: string;
      driverId?: string;
      vehicleId?: string;
      departureDatetime: string;
      returnDatetime: string;
    }
  ): ConflictCheckResult {
    const { tripId, driverId, vehicleId, departureDatetime, returnDatetime } = candidate;

    if (!departureDatetime || !returnDatetime) {
      return { hasConflict: false, conflictingTrips: [] };
    }

    const candStart = new Date(departureDatetime).getTime();
    const candEnd = new Date(returnDatetime).getTime();

    if (isNaN(candStart) || isNaN(candEnd) || candStart >= candEnd) {
      return {
        hasConflict: false,
        conflictingTrips: [],
        reason: 'Intervalo de datas inválido.',
      };
    }

    const conflictingTrips = allTrips.filter((trip) => {
      // Ignora a própria viagem se for edição
      if (trip.id === tripId) return false;

      // Apenas viagens confirmadas geram bloqueio
      if (trip.status !== 'Confirmado ao Demandante') return false;

      // Verifica se há coincidência de motorista ou veículo
      const isSameDriver = driverId && trip.allocated_driver_id === driverId;
      const isSameVehicle = vehicleId && trip.allocated_vehicle_id === vehicleId;

      if (!isSameDriver && !isSameVehicle) return false;

      // Verifica sobreposição de horário: StartA < EndB && EndA > StartB
      const tripStart = new Date(trip.departure_datetime).getTime();
      const tripEnd = new Date(trip.return_datetime).getTime();

      const hasOverlap = candStart < tripEnd && candEnd > tripStart;
      return hasOverlap;
    });

    if (conflictingTrips.length > 0) {
      const reasons: string[] = [];
      conflictingTrips.forEach((t) => {
        if (driverId && t.allocated_driver_id === driverId) {
          reasons.push(`Motorista já alocado no Processo ${t.process_number}`);
        }
        if (vehicleId && t.allocated_vehicle_id === vehicleId) {
          reasons.push(`Veículo já alocado no Processo ${t.process_number}`);
        }
      });

      return {
        hasConflict: true,
        conflictingTrips,
        reason: Array.from(new Set(reasons)).join(' | '),
      };
    }

    return {
      hasConflict: false,
      conflictingTrips: [],
    };
  }
}
