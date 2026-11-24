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
