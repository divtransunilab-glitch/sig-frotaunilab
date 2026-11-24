import { City, TripLeg, TripRequest } from '../types';

export const DRIVER_QUERY_PARAM = 'motorista';

/**
 * Gera a URL pública mobile da Ordem de Tráfego Digital para o motorista.
 */
export function buildDriverOrderUrl(tripId: string): string {
  if (typeof window === 'undefined') return `?${DRIVER_QUERY_PARAM}=${encodeURIComponent(tripId)}`;
  const url = new URL(window.location.href);
  url.search = '';
  url.hash = '';
  url.searchParams.set(DRIVER_QUERY_PARAM, tripId);
  return url.toString();
}

/**
 * Lê o ID da viagem da query string (?motorista=<tripId>), se presente.
 */
export function getDriverTripIdFromUrl(): string | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const id = params.get(DRIVER_QUERY_PARAM);
  return id && id.trim() ? id.trim() : null;
}

/**
 * Monta link de navegação no Google Maps com origem, destino e paradas intermediárias opcionais.
 */
export function buildGoogleMapsUrl(
  origin: string,
  destination: string,
  waypoints?: string[]
): string {
  const params = new URLSearchParams({
    api: '1',
    origin: origin.trim(),
    destination: destination.trim(),
    travelmode: 'driving',
  });

  const cleanWaypoints = (waypoints || []).map((w) => w.trim()).filter(Boolean);
  if (cleanWaypoints.length > 0) {
    params.set('waypoints', cleanWaypoints.join('|'));
  }

  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

/**
 * Monta link de navegação direta no Waze para o destino.
 */
export function buildWazeUrl(destination: string): string {
  return `https://waze.com/ul?q=${encodeURIComponent(destination.trim())}&navigate=yes`;
}

/**
 * Formata telefone brasileiro para link wa.me (com DDI 55).
 */
export function buildWhatsAppUrl(phone?: string, message?: string): string {
  const digits = (phone || '').replace(/\D/g, '');
  const waNumber = digits.length >= 10 ? (digits.startsWith('55') ? digits : `55${digits}`) : '';
  const query = message ? `?text=${encodeURIComponent(message)}` : '';
  return waNumber ? `https://wa.me/${waNumber}${query}` : `https://wa.me/${query}`;
}

/**
 * Monta os trechos padrão de uma viagem (Ida -> Paradas -> Destino -> Retorno à Origem).
 * Ex.: Redenção -> Fortaleza gera:
 *   1) Redenção ➔ Fortaleza
 *   2) Fortaleza ➔ Redenção
 */
export function buildDefaultTripLegs(trip: TripRequest, cities: City[]): TripLeg[] {
  if (Array.isArray(trip.trip_legs) && trip.trip_legs.length > 0) {
    return trip.trip_legs;
  }

  const getCityLabel = (id: string) => {
    const found = cities.find((c) => c.id === id);
    return found ? found.name : id;
  };

  const originName = getCityLabel(trip.origin_city_id);
  const destName = getCityLabel(trip.destination_city_id);
  const intermediates = (trip.intermediate_cities || [])
    .map((id) => getCityLabel(id))
    .filter((name) => Boolean(name) && name !== originName && name !== destName);

  const stops = [originName, ...intermediates, destName];
  const legs: TripLeg[] = [];

  for (let i = 0; i < stops.length - 1; i++) {
    legs.push({
      id: `leg-${i + 1}`,
      origin: stops[i],
      destination: stops[i + 1],
      odometer_start: i === 0 ? trip.odometer_start : undefined,
    });
  }

  // Trecho de retorno (Destino -> Origem), quando origem != destino
  if (originName !== destName) {
    legs.push({
      id: `leg-${legs.length + 1}`,
      origin: destName,
      destination: originName,
      odometer_end: trip.odometer_end,
    });
  }

  return legs;
}

/**
 * Formata resumo textual dos trechos de KM (para exibição em relatórios e fallback).
 */
export function formatTripLegsSummary(legs?: TripLeg[]): string {
  if (!Array.isArray(legs) || legs.length === 0) return '';
  return legs
    .map((leg) => {
      const kmPart =
        leg.distance_km !== undefined && leg.distance_km !== null
          ? `${leg.distance_km} km`
          : leg.odometer_start !== undefined && leg.odometer_end !== undefined
          ? `${Number((leg.odometer_end - leg.odometer_start).toFixed(1))} km`
          : '-';
      const odoPart =
        leg.odometer_start !== undefined && leg.odometer_end !== undefined
          ? ` (${leg.odometer_start} → ${leg.odometer_end})`
          : '';
      return `${leg.origin} ➔ ${leg.destination}: ${kmPart}${odoPart}`;
    })
    .join(' | ');
}
