// Shared Mapbox Directions helpers (driving-traffic profile).
// Used by route map views to build snapped polylines between waypoints,
// with a per-leg in-memory cache and graceful fallback to straight lines.

export interface RouteLeg {
  coords: [number, number][];
  snapped: boolean;
  distanceMeters: number;
  durationSeconds: number;
}

export interface BuiltRoute {
  merged: [number, number][];
  legs: RouteLeg[];
  totalDistanceMeters: number;
  totalDurationSeconds: number;
}

interface CachedLeg {
  coords: [number, number][];
  distance: number;
  duration: number;
}

const directionsCache = new Map<string, CachedLeg>();

function legKey(a: [number, number], b: [number, number]) {
  return `${a[0].toFixed(5)},${a[1].toFixed(5)}->${b[0].toFixed(5)},${b[1].toFixed(5)}`;
}

async function fetchLeg(
  from: [number, number],
  to: [number, number],
  token: string,
  signal?: AbortSignal,
  onAuthError?: () => void
): Promise<CachedLeg | null> {
  const key = legKey(from, to);
  const cached = directionsCache.get(key);
  if (cached) return cached;

  if (from[0] === to[0] && from[1] === to[1]) {
    return { coords: [from, to], distance: 0, duration: 0 };
  }

  const url = `https://api.mapbox.com/directions/v5/mapbox/driving-traffic/${from[0]},${from[1]};${to[0]},${to[1]}?geometries=geojson&overview=full&steps=false&access_token=${token}`;

  try {
    const res = await fetch(url, { signal });
    if (res.status === 401 || res.status === 403) {
      console.error("Mapbox Directions API rejected token (401/403).");
      onAuthError?.();
      return null;
    }
    if (!res.ok) return null;
    const data = await res.json();
    const route = data?.routes?.[0];
    const coords = route?.geometry?.coordinates as [number, number][] | undefined;
    if (coords && coords.length) {
      const entry: CachedLeg = {
        coords,
        distance: typeof route.distance === "number" ? route.distance : 0,
        duration: typeof route.duration === "number" ? route.duration : 0,
      };
      directionsCache.set(key, entry);
      return entry;
    }
    return null;
  } catch (err: any) {
    if (err?.name === "AbortError") return null;
    console.error("Directions leg error", err);
    return null;
  }
}

export async function buildDrivingPolylineWithLegs(
  coords: [number, number][],
  token: string,
  signal?: AbortSignal,
  onAuthError?: () => void
): Promise<BuiltRoute> {
  if (coords.length < 2) {
    return { merged: coords, legs: [], totalDistanceMeters: 0, totalDurationSeconds: 0 };
  }

  const merged: [number, number][] = [];
  const legs: RouteLeg[] = [];
  let totalDistance = 0;
  let totalDuration = 0;

  for (let i = 0; i < coords.length - 1; i++) {
    const from = coords[i];
    const to = coords[i + 1];
    const leg = await fetchLeg(from, to, token, signal, onAuthError);

    if (leg && leg.coords.length > 1) {
      if (merged.length === 0) merged.push(...leg.coords);
      else merged.push(...leg.coords.slice(1));
      legs.push({ coords: leg.coords, snapped: true, distanceMeters: leg.distance, durationSeconds: leg.duration });
      totalDistance += leg.distance;
      totalDuration += leg.duration;
    } else {
      if (merged.length === 0) merged.push(from, to);
      else merged.push(to);
      legs.push({ coords: [from, to], snapped: false, distanceMeters: 0, durationSeconds: 0 });
    }

    // Spread requests slightly to avoid rate limits.
    await new Promise((r) => setTimeout(r, 80));
  }

  return { merged, legs, totalDistanceMeters: totalDistance, totalDurationSeconds: totalDuration };
}