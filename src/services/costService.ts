import { FuelPrices, Vehicle, TripRequest, FuelType } from '../types';

const FUEL_PRICES_STORAGE_KEY = 'sigfrota_fuel_prices';

export const DEFAULT_FUEL_PRICES: FuelPrices = {
  gasoline: 5.89, // R$ 5,89 / Litro
  diesel: 5.98,   // R$ 5,98 / Litro
  ethanol: 4.39,  // R$ 4,39 / Litro
  maintenancePerKm: 0.45, // R$ 0,45 / KM médio de manutenção/desgaste
};

export interface TripCostBreakdown {
  km: number;
  fuelType: FuelType;
  avgKmPerLiter: number;
  fuelPricePerLiter: number;
  fuelLiters: number;
  fuelCost: number;
  operationalCostPerKm: number; // Custo de manutenção por km
  operationalCost: number;      // Total gasto em manutenção
  totalCost: number;            // Combustível + Manutenção
  fuelCostPerKm: number;
  totalCostPerKm: number;
}

export interface VehicleCostStats {
  vehicle: Vehicle;
  totalTrips: number;
  totalKm: number;
  totalFuelLiters: number;
  totalFuelCost: number;
  totalOperationalCost: number; // Total Manutenção
  totalCost: number;
  fuelCostPerKm: number;
  operationalCostPerKm: number;
  totalCostPerKm: number;
}

export class CostService {
  /**
   * Obtém os preços atuais e custos de manutenção configurados
   */
  static getFuelPrices(): FuelPrices {
    try {
      const data = localStorage.getItem(FUEL_PRICES_STORAGE_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        return {
          gasoline: parsed.gasoline ?? DEFAULT_FUEL_PRICES.gasoline,
          diesel: parsed.diesel ?? DEFAULT_FUEL_PRICES.diesel,
          ethanol: parsed.ethanol ?? DEFAULT_FUEL_PRICES.ethanol,
          maintenancePerKm: parsed.maintenancePerKm ?? DEFAULT_FUEL_PRICES.maintenancePerKm,
        };
      }
    } catch {
      // fallback
    }
    return DEFAULT_FUEL_PRICES;
  }

  /**
   * Salva novos parâmetros de combustíveis e manutenção
   */
  static saveFuelPrices(prices: FuelPrices): void {
    try {
      localStorage.setItem(FUEL_PRICES_STORAGE_KEY, JSON.stringify(prices));
    } catch {
      // ignore
    }
  }

  /**
   * Reseta os parâmetros para o padrão
   */
  static resetFuelPrices(): FuelPrices {
    try {
      localStorage.removeItem(FUEL_PRICES_STORAGE_KEY);
    } catch {
      // ignore
    }
    return DEFAULT_FUEL_PRICES;
  }

  /**
   * Obtém o preço do litro correspondente ao tipo de combustível do veículo
   */
  static getPriceForFuelType(fuelType: FuelType = 'Gasolina', prices: FuelPrices = DEFAULT_FUEL_PRICES): number {
    switch (fuelType) {
      case 'Diesel S10':
        return Number(prices.diesel) || DEFAULT_FUEL_PRICES.diesel;
      case 'Etanol':
        return Number(prices.ethanol) || DEFAULT_FUEL_PRICES.ethanol;
      case 'Gasolina':
      case 'Flex':
      default:
        return Number(prices.gasoline) || DEFAULT_FUEL_PRICES.gasoline;
    }
  }

  /**
   * Calcula o detalhamento completo de combustível e custos de uma viagem específica
   */
  static calculateTripCost(
    trip: TripRequest,
    vehicle?: Vehicle,
    customPrices?: FuelPrices
  ): TripCostBreakdown {
    const prices = customPrices || this.getFuelPrices();
    const km = Number(trip.real_km || trip.estimated_km) || 0;

    // Valores padrão caso veículo não esteja cadastrado ou seja alocação temporária
    const fuelType: FuelType = vehicle?.fuel_type || 'Diesel S10';
    const avgKmPerLiter = Number(vehicle?.avg_km_per_liter) || 9.0;
    const operationalCostPerKm = Number(vehicle?.operational_cost_per_km !== undefined ? vehicle.operational_cost_per_km : prices.maintenancePerKm) || 0.45;

    const fuelPricePerLiter = this.getPriceForFuelType(fuelType, prices);

    const fuelLiters = km > 0 && avgKmPerLiter > 0 ? km / avgKmPerLiter : 0;
    const fuelCost = fuelLiters * fuelPricePerLiter;
    const operationalCost = km * operationalCostPerKm;
    const totalCost = fuelCost + operationalCost;

    const fuelCostPerKm = avgKmPerLiter > 0 ? fuelPricePerLiter / avgKmPerLiter : 0;
    const totalCostPerKm = km > 0 ? totalCost / km : fuelCostPerKm + operationalCostPerKm;

    return {
      km,
      fuelType,
      avgKmPerLiter,
      fuelPricePerLiter,
      fuelLiters,
      fuelCost,
      operationalCostPerKm,
      operationalCost,
      totalCost,
      fuelCostPerKm,
      totalCostPerKm,
    };
  }

  /**
   * Calcula as estatísticas e custos consolidados de um veículo em uma lista de viagens
   */
  static calculateVehicleStats(
    vehicle: Vehicle,
    trips: TripRequest[],
    customPrices?: FuelPrices
  ): VehicleCostStats {
    const prices = customPrices || this.getFuelPrices();
    const vehicleTrips = trips.filter((t) => t.allocated_vehicle_id === vehicle.id);

    let totalKm = 0;
    let totalFuelLiters = 0;
    let totalFuelCost = 0;
    let totalOperationalCost = 0;

    vehicleTrips.forEach((trip) => {
      const breakdown = this.calculateTripCost(trip, vehicle, prices);
      totalKm += breakdown.km;
      totalFuelLiters += breakdown.fuelLiters;
      totalFuelCost += breakdown.fuelCost;
      totalOperationalCost += breakdown.operationalCost;
    });

    const totalCost = totalFuelCost + totalOperationalCost;
    const fuelPricePerLiter = this.getPriceForFuelType(vehicle.fuel_type, prices);
    const avgKmPerLiter = Number(vehicle.avg_km_per_liter) || 9.0;
    const operationalCostPerKm = Number(vehicle.operational_cost_per_km !== undefined ? vehicle.operational_cost_per_km : prices.maintenancePerKm) || 0.45;

    const fuelCostPerKm = avgKmPerLiter > 0 ? fuelPricePerLiter / avgKmPerLiter : 0;
    const totalCostPerKm = totalKm > 0 ? totalCost / totalKm : fuelCostPerKm + operationalCostPerKm;

    return {
      vehicle,
      totalTrips: vehicleTrips.length,
      totalKm,
      totalFuelLiters,
      totalFuelCost,
      totalOperationalCost,
      totalCost,
      fuelCostPerKm,
      operationalCostPerKm,
      totalCostPerKm,
    };
  }
}
