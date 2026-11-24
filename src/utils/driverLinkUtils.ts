import { City, Driver, TripLeg, TripRequest } from '../types';

export const DRIVER_QUERY_PARAM = 'motorista';
export const DRIVER_TOKEN_PARAM = 'chave';

/**
 * Gera um token secreto aleatório de 16 caracteres para o link único da viagem.
 */
export function generateDriverAccessToken(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const arr = new Uint8Array(16);
    crypto.getRandomValues(arr);
    for (let i = 0; i < arr.length; i++) {
      result += chars[arr[i] % chars.length];
    }
    return result;
  }
  for (let i = 0; i < 16; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

/**
 * Gera a URL pública mobile da Ordem de Tráfego Digital para o motorista (com token único).
 */
export function buildDriverOrderUrl(tripId: string, accessToken?: string): string {
  if (typeof window === 'undefined') {
    const tokenPart = accessToken ? `&${DRIVER_TOKEN_PARAM}=${encodeURIComponent(accessToken)}` : '';
    return `?${DRIVER_QUERY_PARAM}=${encodeURIComponent(tripId)}${tokenPart}`;
  }
  const url = new URL(window.location.href);
  url.search = '';
  url.hash = '';
  url.searchParams.set(DRIVER_QUERY_PARAM, tripId);
  if (accessToken && accessToken.trim()) {
    url.searchParams.set(DRIVER_TOKEN_PARAM, accessToken.trim());
  }
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
 * Lê o token único da viagem (?chave=<token>), se presente.
 */
export function getDriverTokenFromUrl(): string | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const token = params.get(DRIVER_TOKEN_PARAM);
  return token && token.trim() ? token.trim() : null;
}

/**
 * Retorna os códigos válidos de 4 dígitos para o motorista escalado (PIN, 4 últimos da CNH ou 4 últimos do telefone).
 */
export function getExpectedDriverCodes(driver?: Driver): {
  codes: string[];
  hint: string;
} {
  if (!driver) return { codes: [], hint: '4 dígitos de identificação' };
  const codes: string[] = [];
  const hints: string[] = [];

  const pin = (driver.access_pin || '').replace(/\D/g, '');
  if (pin.length >= 4) {
    codes.push(pin);
    hints.push('PIN');
  }

  const cnhDigits = (driver.cnh_number || '').replace(/\D/g, '');
  if (cnhDigits.length >= 4) {
    codes.push(cnhDigits.slice(-4));
    hints.push('4 últimos dígitos da CNH');
  }

  const phoneDigits = (driver.phone || '').replace(/\D/g, '');
  if (phoneDigits.length >= 4) {
    codes.push(phoneDigits.slice(-4));
    hints.push('4 últimos dígitos do telefone');
  }

  return {
    codes: Array.from(new Set(codes)),
    hint: hints.length > 0 ? hints.join(' ou ') : '4 últimos dígitos do telefone/CNH',
  };
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
