import { useEffect, useState } from "react";

export type GeoState = {
  coords: { lat: number; lng: number; accuracy: number } | null;
  error: string | null;
  distance: number | null;
  inRadius: boolean;
};

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Polls geolocation every 10s. Returns distance to venue and whether trainer is inside the larger of (venue radius, 200m). */
export function useGeoGatekeeper(
  venue: { latitude?: number | null; longitude?: number | null; geo_radius?: number | null } | null | undefined,
  enabled: boolean = true,
): GeoState {
  const [coords, setCoords] = useState<GeoState["coords"]>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || typeof navigator === "undefined" || !navigator.geolocation) {
      if (enabled) setError("Geolocation is unavailable on this device");
      return;
    }
    let cancelled = false;
    function read() {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (cancelled) return;
          setError(null);
          setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy });
        },
        (err) => { if (!cancelled) setError(err.message); },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 },
      );
    }
    read();
    const id = window.setInterval(read, 10000);
    return () => { cancelled = true; window.clearInterval(id); };
  }, [enabled]);

  const radius = Math.max(Number(venue?.geo_radius ?? 0), 200);
  let distance: number | null = null;
  if (coords && venue?.latitude != null && venue?.longitude != null) {
    distance = haversine(coords.lat, coords.lng, Number(venue.latitude), Number(venue.longitude));
  }
  return { coords, error, distance, inRadius: distance != null && distance <= radius };
}