import { City, DistanceMatrixItem } from '../types';
import { INITIAL_CITIES, INITIAL_DISTANCE_MATRIX } from '../data/initialData';

const STORAGE_KEY_CITIES = 'sigfrota_cities';
const STORAGE_KEY_DISTANCES = 'sigfrota_distances';

export class DistanceService {
  private static loadCities(): City[] {
    const saved = localStorage.getItem(STORAGE_KEY_CITIES);
    if (saved) {
      try {
        return JSON.parse(saved);
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
        return JSON.parse(saved);
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
    return newCity;
  }

  static getDistances(): DistanceMatrixItem[] {
    return this.loadDistances();
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
   * Retorna KM total estimado para ida e volta
   */
  static calculateTotalKm(originCityId: string, destCityId: string): number {
    const oneWay = this.getDistance(originCityId, destCityId);
    return oneWay * 2;
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
