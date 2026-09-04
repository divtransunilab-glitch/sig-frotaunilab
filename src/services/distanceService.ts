import { City, DistanceMatrixItem } from '../types';
import { INITIAL_CITIES, INITIAL_DISTANCE_MATRIX } from '../data/initialData';
import { supabase } from './supabaseClient';

const STORAGE_KEY_CITIES = 'sigfrota_cities';
const STORAGE_KEY_DISTANCES = 'sigfrota_distances';

export class DistanceService {
  private static loadCities(): City[] {
    const saved = localStorage.getItem(STORAGE_KEY_CITIES);
    if (saved) {
      try {
        const parsed: City[] = JSON.parse(saved);
        if (parsed && parsed.length >= INITIAL_CITIES.length) {
          return parsed;
        }
      } catch (e) {
        console.error('Erro ao ler cidades do storage', e);
      }
    }
    localStorage.setItem(STORAGE_KEY_CITIES, JSON.stringify(INITIAL_CITIES));
    return INITIAL_CITIES;
  }

  private static loadDistances(): DistanceMatrixItem[] {
    const saved = localStorage.getItem(STORAGE_KEY_DISTANCES);
    if (saved) {
      try {
        const parsed: DistanceMatrixItem[] = JSON.parse(saved);
        if (parsed && parsed.length >= INITIAL_DISTANCE_MATRIX.length) {
          return parsed;
        }
      } catch (e) {
        console.error('Erro ao ler distâncias do storage', e);
      }
    }
    localStorage.setItem(STORAGE_KEY_DISTANCES, JSON.stringify(INITIAL_DISTANCE_MATRIX));
    return INITIAL_DISTANCE_MATRIX;
  }

  static getCities(): City[] {
    return this.loadCities();
  }

  static async fetchCitiesFromSupabase(): Promise<City[]> {
    try {
      const { data, error } = await supabase
        .from('cities')
        .select('*')
        .order('name', { ascending: true });

      if (!error && data && data.length > 0) {
        localStorage.setItem(STORAGE_KEY_CITIES, JSON.stringify(data));
        return data as City[];
      }
    } catch (e) {
      console.warn('Falha ao buscar cidades no Supabase:', e);
    }
    return this.getCities();
  }

  static getCityById(id: string): City | undefined {
    return this.getCities().find((c) => c.id === id);
  }

  static addCity(city: Omit<City, 'id'>): City {
    const cities = this.getCities();
    const newCity: City = {
      ...city,
      id: `city-${Date.now()}`,
    };
    const updated = [...cities, newCity];
    localStorage.setItem(STORAGE_KEY_CITIES, JSON.stringify(updated));

    // Sincroniza em segundo plano com o Supabase
    (async () => {
      try {
        const { error } = await supabase.from('cities').upsert([newCity]);
        if (error) console.error('Erro ao salvar cidade no Supabase:', error);
      } catch (err) {
        console.error('Falha ao enviar cidade ao Supabase:', err);
      }
    })();

    return newCity;
  }

  static getDistances(): DistanceMatrixItem[] {
    return this.loadDistances();
  }

  static async fetchDistancesFromSupabase(): Promise<DistanceMatrixItem[]> {
    try {
      const { data, error } = await supabase
        .from('distance_matrix')
        .select('*');

      if (!error && data && data.length > 0) {
        localStorage.setItem(STORAGE_KEY_DISTANCES, JSON.stringify(data));
        return data as DistanceMatrixItem[];
      }
    } catch (e) {
      console.warn('Falha ao buscar matriz de distâncias no Supabase:', e);
    }
    return this.getDistances();
  }

  /**
   * Busca bidirecional de distância em KM entre duas cidades
   */
  static getDistance(originCityId: string, destCityId: string): number {
    if (originCityId === destCityId) return 0;
    const distances = this.getDistances();
    const match = distances.find(
      (d) =>
        (d.origin_city_id === originCityId && d.destination_city_id === destCityId) ||
        (d.origin_city_id === destCityId && d.destination_city_id === originCityId)
    );
    return match ? match.distance_km : 0;
  }

  /**
   * Retorna KM total estimado considerando Origem, Cidades Intermediárias/Secundárias, Destino Principal e KM Extra Local.
   * Rota: Origem -> Intermediária 1 -> Intermediária 2 -> Destino Principal -> Origem (Volta) + extraKm
   */
  static calculateTotalKm(
    originCityId: string, 
    destCityId: string, 
    intermediateCityIds?: string[], 
    extraKm?: number
  ): number {
    const validIntermediates = (intermediateCityIds || []).filter(
      (id) => id && id !== originCityId && id !== destCityId
    );

    const extra = Number(extraKm) || 0;

    if (validIntermediates.length === 0) {
      const oneWay = this.getDistance(originCityId, destCityId);
      const baseKm = oneWay * 2;
      return baseKm + extra;
    }

    // Calcula itinerário sequencial: Origem -> Int1 -> Int2 -> ... -> Destino -> Origem
    let totalKm = 0;
    let currentCityId = originCityId;

    // Trechos intermediários
    for (const nextCityId of validIntermediates) {
      totalKm += this.getDistance(currentCityId, nextCityId);
      currentCityId = nextCityId;
    }

    // Trecho da última intermediária para o destino principal
    totalKm += this.getDistance(currentCityId, destCityId);

    // Trecho de volta do destino principal para a origem
    totalKm += this.getDistance(destCityId, originCityId);

    return Math.round(totalKm + extra);
  }

  /**
   * Atualiza ou insere uma distância entre duas cidades
   */
  static updateDistance(originCityId: string, destCityId: string, distanceKm: number): DistanceMatrixItem {
    const distances = this.getDistances();
    const existingIndex = distances.findIndex(
      (d) =>
        (d.origin_city_id === originCityId && d.destination_city_id === destCityId) ||
        (d.origin_city_id === destCityId && d.destination_city_id === originCityId)
    );

    let updatedList: DistanceMatrixItem[];
    let item: DistanceMatrixItem;

    if (existingIndex >= 0) {
      item = {
        ...distances[existingIndex],
        distance_km: distanceKm,
        last_updated: new Date().toISOString(),
      };
      updatedList = [...distances];
      updatedList[existingIndex] = item;
    } else {
      item = {
        id: `dist-${Date.now()}`,
        origin_city_id: originCityId,
        destination_city_id: destCityId,
        distance_km: distanceKm,
        last_updated: new Date().toISOString(),
      };
      updatedList = [...distances, item];
    }

    localStorage.setItem(STORAGE_KEY_DISTANCES, JSON.stringify(updatedList));

    // Sincroniza em segundo plano com o Supabase
    (async () => {
      try {
        const { error } = await supabase.from('distance_matrix').upsert([item]);
        if (error) console.error('Erro ao salvar distância no Supabase:', error);
      } catch (err) {
        console.error('Falha ao enviar distância ao Supabase:', err);
      }
    })();

    return item;
  }

  /**
   * Restaura os valores padrão de cidades e distâncias
   */
  static resetToDefaults(): void {
    localStorage.setItem(STORAGE_KEY_CITIES, JSON.stringify(INITIAL_CITIES));
    localStorage.setItem(STORAGE_KEY_DISTANCES, JSON.stringify(INITIAL_DISTANCE_MATRIX));
  }
}
