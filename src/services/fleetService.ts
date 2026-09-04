import { Vehicle, Driver, Contractor, VehicleType, InstitutionalUnit } from '../types';
import { INITIAL_VEHICLES, INITIAL_DRIVERS, INITIAL_CONTRACTORS, INITIAL_UNITS } from '../data/initialData';
import { supabase } from './supabaseClient';

const STORAGE_KEY_VEHICLES = 'sigfrota_vehicles';
const STORAGE_KEY_DRIVERS = 'sigfrota_drivers';
const STORAGE_KEY_CONTRACTORS = 'sigfrota_contractors';
const STORAGE_KEY_UNITS = 'sigfrota_units';

export class FleetService {
  // --- VEÍCULOS ---
  static getVehicles(): Vehicle[] {
    const saved = localStorage.getItem(STORAGE_KEY_VEHICLES);
    if (saved) {
      try {
        const parsed: Vehicle[] = JSON.parse(saved);
        if (parsed && parsed.length >= INITIAL_VEHICLES.length) {
          return parsed;
        }
      } catch (e) {
        console.error('Erro ao ler veículos do storage', e);
      }
    }
    localStorage.setItem(STORAGE_KEY_VEHICLES, JSON.stringify(INITIAL_VEHICLES));
    return INITIAL_VEHICLES;
  }

  static async fetchVehiclesFromSupabase(): Promise<Vehicle[]> {
    try {
      const { data, error } = await supabase
        .from('vehicles')
        .select('*')
        .order('plate', { ascending: true });

      if (!error && data && data.length > 0) {
        localStorage.setItem(STORAGE_KEY_VEHICLES, JSON.stringify(data));
        return data as Vehicle[];
      }
    } catch (e) {
      console.warn('Falha ao sincronizar veículos com Supabase:', e);
    }
    return this.getVehicles();
  }

  static getVehicleById(id?: string): Vehicle | undefined {
    if (!id) return undefined;
    return this.getVehicles().find((v) => v.id === id);
  }

  static saveVehicle(vehicle: Omit<Vehicle, 'id'> & { id?: string }): Vehicle {
    const vehicles = this.getVehicles();
    let saved: Vehicle;
    if (vehicle.id) {
      const idx = vehicles.findIndex((v) => v.id === vehicle.id);
      saved = { ...vehicles[idx], ...vehicle } as Vehicle;
      vehicles[idx] = saved;
    } else {
      saved = {
        ...vehicle,
        id: `veh-${Date.now()}`,
      };
      vehicles.push(saved);
    }
    localStorage.setItem(STORAGE_KEY_VEHICLES, JSON.stringify(vehicles));

    // Sincroniza em segundo plano com o Supabase
    (async () => {
      try {
        const { error } = await supabase.from('vehicles').upsert([saved]);
        if (error) console.error('Erro ao salvar veículo no Supabase:', error);
      } catch (err) {
        console.error('Falha ao enviar veículo ao Supabase:', err);
      }
    })();

    return saved;
  }

  static async deleteVehicle(id: string): Promise<void> {
    const vehicles = this.getVehicles().filter((v) => v.id !== id);
    localStorage.setItem(STORAGE_KEY_VEHICLES, JSON.stringify(vehicles));
    try {
      await supabase.from('vehicles').delete().eq('id', id);
    } catch (e) {
      console.warn('Erro ao deletar veículo do Supabase:', e);
    }
  }

  // --- MOTORISTAS ---
  static getDrivers(): Driver[] {
    const saved = localStorage.getItem(STORAGE_KEY_DRIVERS);
    if (saved) {
      try {
        const parsed: Driver[] = JSON.parse(saved);
        if (parsed && parsed.length >= INITIAL_DRIVERS.length) {
          return parsed;
        }
      } catch (e) {
        console.error('Erro ao ler motoristas do storage', e);
      }
    }
    localStorage.setItem(STORAGE_KEY_DRIVERS, JSON.stringify(INITIAL_DRIVERS));
    return INITIAL_DRIVERS;
  }

  static async fetchDriversFromSupabase(): Promise<Driver[]> {
    try {
      const { data, error } = await supabase
        .from('drivers')
        .select('*')
        .order('name', { ascending: true });

      if (!error && data && data.length > 0) {
        localStorage.setItem(STORAGE_KEY_DRIVERS, JSON.stringify(data));
        return data as Driver[];
      }
    } catch (e) {
      console.warn('Falha ao sincronizar motoristas com Supabase:', e);
    }
    return this.getDrivers();
  }

  static getDriverById(id?: string): Driver | undefined {
    if (!id) return undefined;
    return this.getDrivers().find((d) => d.id === id);
  }

  static getDriversByContractor(contractorId?: string): Driver[] {
    const drivers = this.getDrivers();
    if (!contractorId) return drivers;
    return drivers.filter((d) => d.contractor_id === contractorId);
  }

  static saveDriver(driver: Omit<Driver, 'id'> & { id?: string }): Driver {
    const drivers = this.getDrivers();
    let saved: Driver;
    if (driver.id) {
      const idx = drivers.findIndex((d) => d.id === driver.id);
      saved = { ...drivers[idx], ...driver } as Driver;
      drivers[idx] = saved;
    } else {
      saved = {
        ...driver,
        id: `driv-${Date.now()}`,
      };
      drivers.push(saved);
    }
    localStorage.setItem(STORAGE_KEY_DRIVERS, JSON.stringify(drivers));

    // Sincroniza em segundo plano com o Supabase
    (async () => {
      try {
        const { error } = await supabase.from('drivers').upsert([saved]);
        if (error) console.error('Erro ao salvar motorista no Supabase:', error);
      } catch (err) {
        console.error('Falha ao enviar motorista ao Supabase:', err);
      }
    })();

    return saved;
  }

  static async deleteDriver(id: string): Promise<void> {
    const drivers = this.getDrivers().filter((d) => d.id !== id);
    localStorage.setItem(STORAGE_KEY_DRIVERS, JSON.stringify(drivers));
    try {
      await supabase.from('drivers').delete().eq('id', id);
    } catch (e) {
      console.warn('Erro ao deletar motorista do Supabase:', e);
    }
  }

  // --- CONTRATADAS ---
  static getContractors(): Contractor[] {
    const saved = localStorage.getItem(STORAGE_KEY_CONTRACTORS);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Erro ao ler contratadas do storage', e);
      }
    }
    localStorage.setItem(STORAGE_KEY_CONTRACTORS, JSON.stringify(INITIAL_CONTRACTORS));
    return INITIAL_CONTRACTORS;
  }

  static async fetchContractorsFromSupabase(): Promise<Contractor[]> {
    try {
      const { data, error } = await supabase
        .from('contractors')
        .select('*')
        .order('name', { ascending: true });

      if (!error && data && data.length > 0) {
        localStorage.setItem(STORAGE_KEY_CONTRACTORS, JSON.stringify(data));
        return data as Contractor[];
      }
    } catch (e) {
      console.warn('Falha ao sincronizar contratadas com Supabase:', e);
    }
    return this.getContractors();
  }

  static getContractorById(id?: string): Contractor | undefined {
    if (!id) return undefined;
    return this.getContractors().find((c) => c.id === id);
  }

  static saveContractor(contractor: Omit<Contractor, 'id'> & { id?: string }): Contractor {
    const contractors = this.getContractors();
    let saved: Contractor;
    if (contractor.id) {
      const idx = contractors.findIndex((c) => c.id === contractor.id);
      saved = { ...contractors[idx], ...contractor } as Contractor;
      contractors[idx] = saved;
    } else {
      saved = {
        ...contractor,
        id: `cont-${Date.now()}`,
      };
      contractors.push(saved);
    }
    localStorage.setItem(STORAGE_KEY_CONTRACTORS, JSON.stringify(contractors));

    // Sincroniza em segundo plano com o Supabase
    (async () => {
      try {
        const { error } = await supabase.from('contractors').upsert([saved]);
        if (error) console.error('Erro ao salvar contratada no Supabase:', error);
      } catch (err) {
        console.error('Falha ao enviar contratada ao Supabase:', err);
      }
    })();

    return saved;
  }

  static async deleteContractor(id: string): Promise<void> {
    const contractors = this.getContractors().filter((c) => c.id !== id);
    localStorage.setItem(STORAGE_KEY_CONTRACTORS, JSON.stringify(contractors));
    try {
      await supabase.from('contractors').delete().eq('id', id);
    } catch (e) {
      console.warn('Erro ao deletar contratada do Supabase:', e);
    }
  }

  // --- UNIDADES INSTITUCIONAIS ---
  static getUnits(): InstitutionalUnit[] {
    const saved = localStorage.getItem(STORAGE_KEY_UNITS);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Erro ao ler unidades do storage', e);
      }
    }
    localStorage.setItem(STORAGE_KEY_UNITS, JSON.stringify(INITIAL_UNITS));
    return INITIAL_UNITS;
  }

  static async fetchUnitsFromSupabase(): Promise<InstitutionalUnit[]> {
    try {
      const { data, error } = await supabase
        .from('institutional_units')
        .select('*')
        .order('code', { ascending: true });

      if (!error && data && data.length > 0) {
        localStorage.setItem(STORAGE_KEY_UNITS, JSON.stringify(data));
        return data as InstitutionalUnit[];
      }
    } catch (e) {
      console.warn('Falha ao sincronizar unidades com Supabase:', e);
    }
    return this.getUnits();
  }

  static getUnitById(id?: string): InstitutionalUnit | undefined {
    if (!id) return undefined;
    return this.getUnits().find((u) => u.id === id || u.code === id);
  }

  static saveUnit(unit: Omit<InstitutionalUnit, 'id'> & { id?: string }): InstitutionalUnit {
    const units = this.getUnits();
    let saved: InstitutionalUnit;
    if (unit.id) {
      const idx = units.findIndex((u) => u.id === unit.id);
      saved = { ...units[idx], ...unit } as InstitutionalUnit;
      units[idx] = saved;
    } else {
      saved = {
        ...unit,
        id: `unit-${Date.now()}`,
      };
      units.push(saved);
    }
    localStorage.setItem(STORAGE_KEY_UNITS, JSON.stringify(units));

    // Sincroniza em segundo plano com o Supabase
    (async () => {
      try {
        const { error } = await supabase.from('institutional_units').upsert([saved]);
        if (error) console.error('Erro ao salvar unidade institucional no Supabase:', error);
      } catch (err) {
        console.error('Falha ao enviar unidade ao Supabase:', err);
      }
    })();

    return saved;
  }

  static async deleteUnit(id: string): Promise<void> {
    const units = this.getUnits().filter((u) => u.id !== id);
    localStorage.setItem(STORAGE_KEY_UNITS, JSON.stringify(units));
    try {
      await supabase.from('institutional_units').delete().eq('id', id);
    } catch (e) {
      console.warn('Erro ao deletar unidade do Supabase:', e);
    }
  }

  // --- RECOMENDAÇÃO DE VEÍCULO ---
  static recommendVehicleType(passengerCount: number): {
    recommendedType: VehicleType | string;
    description: string;
    minCapacity: number;
  } {
    if (passengerCount <= 4) {
      return {
        recommendedType: 'Sedan ou Caminhonete',
        description: 'Capacidade até 5 lugares recomendada para grupos pequenos de até 4 passageiros.',
        minCapacity: 4,
      };
    } else if (passengerCount <= 15) {
      return {
        recommendedType: 'Van',
        description: 'Van executiva (15 a 16 lugares) recomendada para grupos de 5 a 15 passageiros.',
        minCapacity: 15,
      };
    } else if (passengerCount <= 28) {
      return {
        recommendedType: 'Micro-Ônibus',
        description: 'Micro-ônibus (24 a 28 lugares) recomendado para grupos de 16 a 28 passageiros.',
        minCapacity: 24,
      };
    } else {
      return {
        recommendedType: 'Ônibus',
        description: 'Ônibus rodoviário (40 a 46 lugares) recomendado para grandes delegações (> 28 passageiros).',
        minCapacity: 44,
      };
    }
  }

  static resetToDefaults(): void {
    localStorage.setItem(STORAGE_KEY_VEHICLES, JSON.stringify(INITIAL_VEHICLES));
    localStorage.setItem(STORAGE_KEY_DRIVERS, JSON.stringify(INITIAL_DRIVERS));
    localStorage.setItem(STORAGE_KEY_CONTRACTORS, JSON.stringify(INITIAL_CONTRACTORS));
    localStorage.setItem(STORAGE_KEY_UNITS, JSON.stringify(INITIAL_UNITS));
  }
}
