// Duration calculation for inspections based on type and room count
import { supabase } from "@/integrations/supabase/client";

interface DurationParams {
  synstype: string | null;
  antalVaerelser: number | null;
  raw?: any;
}

// Map full synstype name to abbreviation
const TYPE_MAP: Record<string, string> = {
  "Fraflytningssyn": "FF",
  "Indflytningssyn": "IF",
  "Projektsyn": "PS",
  "Proforma": "PA",
};

// Hardcoded fallback matrix (used if DB fetch fails)
const FALLBACK_MATRIX: Record<string, Record<number, number>> = {
  FF: { 1: 65, 2: 75, 3: 80, 4: 90, 5: 90, 6: 90 },
  IF: { 1: 35, 2: 45, 3: 45, 4: 50, 5: 60, 6: 65 },
  PS: { 1: 35, 2: 45, 3: 45, 4: 50, 5: 60, 6: 65 },
  PA: { 1: 35, 2: 45, 3: 45, 4: 50, 5: 60, 6: 65 },
};

const FALLBACK_MODIFIERS: Record<string, { minutes: number; applies_to: string[] }> = {
  DYMO: { minutes: 5, applies_to: ["IF", "PS"] },
  Cylinderskift: { minutes: 10, applies_to: ["IF", "PS"] },
};

// Cached duration data
let cachedMatrix: Record<string, Record<number, number>> | null = null;
let cachedModifiers: Record<string, { minutes: number; applies_to: string[] }> | null = null;
let fetchPromise: Promise<void> | null = null;

export function clearDurationCache() {
  cachedMatrix = null;
  cachedModifiers = null;
  fetchPromise = null;
}

async function ensureCacheLoaded(): Promise<void> {
  if (cachedMatrix && cachedModifiers) return;
  if (fetchPromise) return fetchPromise;

  fetchPromise = (async () => {
    try {
      const [durRes, modRes] = await Promise.all([
        supabase.from("inspection_durations").select("*"),
        supabase.from("inspection_duration_modifiers" as any).select("*"),
      ]);

      if (durRes.data && durRes.data.length > 0) {
        const m: Record<string, Record<number, number>> = {};
        for (const row of durRes.data) {
          if (!m[row.inspection_type]) m[row.inspection_type] = {};
          m[row.inspection_type][row.rooms] = row.minutes;
        }
        cachedMatrix = m;
      } else {
        cachedMatrix = FALLBACK_MATRIX;
      }

      if (modRes.data && (modRes.data as any[]).length > 0) {
        const mods: Record<string, { minutes: number; applies_to: string[] }> = {};
        for (const row of modRes.data as any[]) {
          mods[row.modifier_name] = { minutes: row.minutes, applies_to: row.applies_to };
        }
        cachedModifiers = mods;
      } else {
        cachedModifiers = FALLBACK_MODIFIERS;
      }
    } catch {
      cachedMatrix = FALLBACK_MATRIX;
      cachedModifiers = FALLBACK_MODIFIERS;
    }
  })();

  return fetchPromise;
}

/**
 * Get the duration matrix (sync - returns fallback if not yet loaded)
 */
function getMatrix(): Record<string, Record<number, number>> {
  return cachedMatrix || FALLBACK_MATRIX;
}

function getModifiers(): Record<string, { minutes: number; applies_to: string[] }> {
  return cachedModifiers || FALLBACK_MODIFIERS;
}

/**
 * Pre-load the duration cache. Call early in app lifecycle.
 */
export function preloadDurationCache(): void {
  ensureCacheLoaded();
}

/**
 * Calculate inspection duration in minutes based on type, room count, and flags
 */
export function calculateInspectionDuration(params: DurationParams): number {
  const { synstype, antalVaerelser, raw } = params;
  const type = TYPE_MAP[synstype || ""] || "IF";
  const rooms = Math.min(Math.max(antalVaerelser || 2, 1), 6);

  const matrix = getMatrix();
  const modifiers = getModifiers();

  // Look up base duration from matrix
  let durationMinutes = matrix[type]?.[rooms] ?? matrix[type]?.[2] ?? 45;

  // Check for DYMO modifier
  let note = "";
  if (raw) {
    const rawData = typeof raw === "string" ? JSON.parse(raw) : raw;
    note = rawData?.Note || "";
  }

  const dymo = modifiers["DYMO"];
  if (dymo && note.toUpperCase().includes("DYMO") && dymo.applies_to.includes(type)) {
    durationMinutes += dymo.minutes;
  }

  // Check for Cylinderskift modifier
  const cyl = modifiers["Cylinderskift"];
  if (cyl && note.toUpperCase().includes("CYLINDERSKIFT") && cyl.applies_to.includes(type)) {
    durationMinutes += cyl.minutes;
  }

  return durationMinutes;
}

/**
 * Calculate end time given a start time and inspection parameters
 */
export function calculateEndTime(startTime: string, params: DurationParams): string {
  const durationMinutes = calculateInspectionDuration(params);
  const [hours, minutes] = startTime.split(":").map(Number);

  const startDate = new Date();
  startDate.setHours(hours, minutes, 0, 0);
  const endDate = new Date(startDate.getTime() + durationMinutes * 60 * 1000);

  return `${String(endDate.getHours()).padStart(2, "0")}:${String(endDate.getMinutes()).padStart(2, "0")}`;
}

/**
 * Get effective duration: use manual override if set, otherwise auto-calculate
 */
export function getEffectiveDuration(item: { duration_minutes?: number | null; synstype: string | null; antal_vaerelser: number | null; raw?: any }): number {
  if (item.duration_minutes != null) return item.duration_minutes;
  return calculateInspectionDuration({ synstype: item.synstype, antalVaerelser: item.antal_vaerelser, raw: item.raw });
}

/**
 * Add minutes to a time string
 */
export function addMinutesToTime(time: string, minutes: number): string {
  const [hours, mins] = time.split(":").map(Number);
  const date = new Date();
  date.setHours(hours, mins, 0, 0);
  date.setMinutes(date.getMinutes() + minutes);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}
