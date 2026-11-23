import { Capacitor, registerPlugin } from "@capacitor/core";

type ExternalLinkPlugin = {
  open(options: { url: string }): Promise<void>;
};

const ExternalLink = registerPlugin<ExternalLinkPlugin>("ExternalLink");

export type MapCoords = { lat: number; lng: number };

/** Coerce DB/number/string GPS into finite lat/lng, or null. */
export function parseMapCoords(
  lat: number | string | null | undefined,
  lng: number | string | null | undefined,
): MapCoords | null {
  const la = typeof lat === "string" ? Number(lat) : lat;
  const ln = typeof lng === "string" ? Number(lng) : lng;
  if (la == null || ln == null || !Number.isFinite(la) || !Number.isFinite(ln)) return null;
  if (la < -90 || la > 90 || ln < -180 || ln > 180) return null;
  return { lat: la, lng: ln };
}

export function mapsSearchUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lat},${lng}`)}`;
}

/** geo: opens the device Maps app on Android when available. */
export function mapsGeoUrl(lat: number, lng: number): string {
  return `geo:${lat},${lng}?q=${lat},${lng}`;
}

export async function openExternalUrl(url: string): Promise<void> {
  if (!url) return;
  if (Capacitor.isNativePlatform()) {
    try {
      await ExternalLink.open({ url });
      return;
    } catch {
      // ponytail: older APKs lack ExternalLink — fall through
    }
  }
  window.open(url, "_blank", "noopener,noreferrer");
}

/** Open the pin in Google Maps / the device maps app. */
export async function openMapsAt(
  lat: number | string | null | undefined,
  lng: number | string | null | undefined,
): Promise<boolean> {
  const coords = parseMapCoords(lat, lng);
  if (!coords) return false;
  const url = Capacitor.isNativePlatform()
    ? mapsGeoUrl(coords.lat, coords.lng)
    : mapsSearchUrl(coords.lat, coords.lng);
  await openExternalUrl(url);
  return true;
}
