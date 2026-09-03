import { TripRequest, Vehicle, Driver, Contractor } from '../types';
import { DistanceService } from './distanceService';
import { FleetService } from './fleetService';
import { TripService } from './tripService';
import { AuditService } from './auditService';
import { safeFormatDate } from '../utils/dateUtils';

export interface GroupingOpportunity {
  id: string;
  dateKey: string; // YYYY-MM-DD
  dateFormatted: string; // DD/MM/YYYY
  originCityId: string;
  destinationCityId: string;
  originName: string;
  destinationName: string;
  departureTimeRange?: string;
  returnTimeRange?: string;
  trips: TripRequest[];
  totalPassengers: number;
  estimatedKmSaved: number;
  estimatedCostSaved: number; // R$
  recommendedVehicleType: string;
  isFullyGrouped: boolean;
  sharedVehicle?: Vehicle;
  sharedDriver?: Driver;
}

export class RideGroupingService {
  /**
   * Identifica todas as oportunidades de agrupamento de viagens (Carona Solidária)
   * cruzando:
   * 1. Mesma cidade de origem e mesma cidade de destino
   * 2. Mesma data de partida
   * 3. Horário de saída compatível (diferença <= 1 hora / 60 minutos)
   * 4. Horário e data de retorno compatíveis (diferença <= 1 hora / 60 minutos)
   */
  static findGroupingOpportunities(trips: TripRequest[]): GroupingOpportunity[] {
    const cities = DistanceService.getCities();
    const getCityName = (id: string) => {
      const c = cities.find((item) => item.id === id);
      return c ? c.name : id;
    };

    const parseTime = (dateVal?: string | Date | null): number | null => {
      if (!dateVal) return null;
      try {
        const d = typeof dateVal === 'string' ? new Date(dateVal) : dateVal;
        const time = d.getTime();
        return isNaN(time) ? null : time;
      } catch {
        return null;
      }
    };

    // Filtra viagens ativas (desconsidera indeferidas e canceladas)
    const activeTrips = trips.filter((t) => {
      return (
        t.status !== 'Indeferido' &&
        t.status !== 'Cancelado pelo Demandante' &&
        t.status !== 'Cancelado pela Unidade Executante'
      );
    });

    // Agrupa inicialmente por: Corredor de Origem + Destino + Data da Saída (YYYY-MM-DD)
    const corridorMap = new Map<string, TripRequest[]>();

    for (const trip of activeTrips) {
      if (!trip.departure_datetime) continue;
      const dateKey = trip.departure_datetime.substring(0, 10);
      const corridorKey = `${dateKey}_${trip.origin_city_id}_${trip.destination_city_id}`;

      if (!corridorMap.has(corridorKey)) {
        corridorMap.set(corridorKey, []);
      }
      corridorMap.get(corridorKey)!.push(trip);
    }

    const MAX_TIME_DIFF_MS = 60 * 60 * 1000; // Tolerância máxima: 1 hora (60 minutos)
    const opportunities: GroupingOpportunity[] = [];

    corridorMap.forEach((corridorTrips, corridorKey) => {
      if (corridorTrips.length < 2) return;

      // Ordena por horário de saída
      const sorted = [...corridorTrips].sort((a, b) => {
        const tA = parseTime(a.departure_datetime) || 0;
        const tB = parseTime(b.departure_datetime) || 0;
        return tA - tB;
      });

      // Clusterização por compatibilidade de horários de saída e retorno (<= 1 hora)
      const clusters: TripRequest[][] = [];

      for (const trip of sorted) {
        const depTime = parseTime(trip.departure_datetime);
        const retTime = parseTime(trip.return_datetime);
        if (!depTime) continue;

        // Tenta encaixar em um cluster existente compatível
        let placed = false;
        for (const cluster of clusters) {
          // A viagem é compatível com o cluster se a diferença de saída e retorno com relação a todos os membros for <= 1 hora
          const isCompatible = cluster.every((member) => {
            const memberDep = parseTime(member.departure_datetime);
            const memberRet = parseTime(member.return_datetime);

            if (!memberDep) return false;
            const depDiff = Math.abs(depTime - memberDep);
            if (depDiff > MAX_TIME_DIFF_MS) return false;

            // Se ambos tiverem data/hora de retorno, checa compatibilidade do retorno
            if (retTime && memberRet) {
              const retDiff = Math.abs(retTime - memberRet);
              if (retDiff > MAX_TIME_DIFF_MS) return false;
            }

            return true;
          });

          if (isCompatible) {
            cluster.push(trip);
            placed = true;
            break;
          }
        }

        if (!placed) {
          clusters.push([trip]);
        }
      }

      // Cria oportunidade para clusters com 2 ou mais viagens
      clusters.forEach((groupTrips, clusterIndex) => {
        if (groupTrips.length >= 2) {
          const first = groupTrips[0];
          const dateKey = first.departure_datetime.substring(0, 10);
          const originId = first.origin_city_id;
          const destId = first.destination_city_id;

          const totalPassengers = groupTrips.reduce((sum, t) => sum + (t.passenger_count || 1), 0);
          const estimatedKm = first.estimated_km || 130;
          
          // KM economizado: (N viagens agrupadas - 1 viagem física realizada) * KM
          const estimatedKmSaved = (groupTrips.length - 1) * estimatedKm;
          
          // Custo médio estimado: R$ 4,80 por KM + diárias evitadas
          const estimatedCostSaved = estimatedKmSaved * 4.8 + (groupTrips.length - 1) * 120;

          // Recomendação de veículo com base na lotação total
          let recommendedVehicleType = 'Sedan / Hatch (até 4 passageiros)';
          if (totalPassengers > 15) {
            recommendedVehicleType = 'Micro-ônibus / Ônibus (acima de 15 passageiros)';
          } else if (totalPassengers > 6) {
            recommendedVehicleType = 'Van Executiva (até 15 passageiros)';
          } else if (totalPassengers > 4) {
            recommendedVehicleType = 'Minivan Spin / Doblò (até 6 passageiros)';
          }

          // Horários de Saída e Retorno Mínimo e Máximo do Grupo
          const depTimes = groupTrips.map(t => safeFormatDate(t.departure_datetime, 'HH:mm')).filter(Boolean);
          const retTimes = groupTrips.map(t => safeFormatDate(t.return_datetime, 'HH:mm')).filter(Boolean);

          const minDep = depTimes.sort()[0];
          const maxDep = depTimes[depTimes.length - 1];
          const departureTimeRange = minDep === maxDep ? minDep : `${minDep} ~ ${maxDep}`;

          const minRet = retTimes.sort()[0];
          const maxRet = retTimes[retTimes.length - 1];
          const returnTimeRange = minRet === maxRet ? minRet : `${minRet} ~ ${maxRet}`;

          // Verifica se todas as viagens já estão compartilhando o mesmo veículo alocado
          const vehicleIds = groupTrips.map((t) => t.allocated_vehicle_id).filter(Boolean);
          const uniqueVehicles = new Set(vehicleIds);
          const isFullyGrouped =
            uniqueVehicles.size === 1 &&
            vehicleIds.length === groupTrips.length &&
            groupTrips.every((t) => t.status === 'Confirmado ao Demandante');

          const sharedVehicle = isFullyGrouped && vehicleIds[0]
            ? FleetService.getVehicleById(vehicleIds[0])
            : undefined;

          const driverIds = groupTrips.map((t) => t.allocated_driver_id).filter(Boolean);
          const sharedDriver = isFullyGrouped && driverIds[0]
            ? FleetService.getDriverById(driverIds[0])
            : undefined;

          opportunities.push({
            id: `${corridorKey}_cluster_${clusterIndex}`,
            dateKey,
            dateFormatted: safeFormatDate(first.departure_datetime, 'dd/MM/yyyy'),
            originCityId: originId,
            destinationCityId: destId,
            originName: getCityName(originId),
            destinationName: getCityName(destId),
            departureTimeRange,
            returnTimeRange,
            trips: groupTrips,
            totalPassengers,
            estimatedKmSaved,
            estimatedCostSaved,
            recommendedVehicleType,
            isFullyGrouped,
            sharedVehicle,
            sharedDriver,
          });
        }
      });
    });

    // Ordena por data mais recente / mais próxima
    return opportunities.sort((a, b) => a.dateKey.localeCompare(b.dateKey));
  }

  /**
   * Agrupa e escala múltiplas viagens para o mesmo veículo e condutor
   */
  static groupAndDispatchTrips(
    opportunity: GroupingOpportunity,
    allocation: {
      contractorId: string;
      driverId: string;
      vehicleId: string;
      notes?: string;
    }
  ): void {
    const vehicle = FleetService.getVehicleById(allocation.vehicleId);
    const driver = FleetService.getDriverById(allocation.driverId);
    const processNumbers = opportunity.trips.map((t) => t.process_number);

    for (const trip of opportunity.trips) {
      const otherProcesses = processNumbers.filter((p) => p !== trip.process_number);
      const groupNote = `[Carona Solidária Institucional] Viagem agrupada no veículo ${vehicle?.model || ''} (${vehicle?.plate || ''}) com o(s) processo(s): ${otherProcesses.join(', ')}. Horários compatíveis (Janela de até 1h).`;
      
      const combinedNotes = trip.notes
        ? `${trip.notes}\n${groupNote}`
        : groupNote;

      TripService.dispatchTrip(trip.id, {
        contractorId: allocation.contractorId,
        driverId: allocation.driverId,
        vehicleId: allocation.vehicleId,
        notes: combinedNotes,
      });

      AuditService.logEvent({
        action: 'Agrupamento de Viagem (Carona Solidária)',
        process_number: trip.process_number,
        target_id: trip.id,
        entity_type: 'Viagem',
        compliance_status: 'Conforme',
        details: `Viagem unificada em carona solidária. Trajeto: ${opportunity.originName} -> ${opportunity.destinationName} em ${opportunity.dateFormatted} (Saída: ${opportunity.departureTimeRange}, Retorno: ${opportunity.returnTimeRange}). Veículo: ${vehicle?.plate} (${vehicle?.model}), Motorista: ${driver?.name}. Total passageiros atendidos: ${opportunity.totalPassengers}.`,
      });
    }
  }
}
