// Duration calculation for inspections based on type and room count

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

/**
 * Calculate inspection duration in minutes based on type, room count, and DYMO presence
 */
export function calculateInspectionDuration(params: DurationParams): number {
  const { synstype, antalVaerelser, raw } = params;
  const type = TYPE_MAP[synstype || ""] || "IF";
  const rooms = antalVaerelser || 2;

  let durationMinutes: number;

  if (type === "FF") {
    // Fraflytningssyn - longer durations
    switch (rooms) {
      case 1: durationMinutes = 65; break;
      case 2: durationMinutes = 75; break;
      case 3: durationMinutes = 80; break;
      case 4:
      case 5:
      case 6:
      default: durationMinutes = 90; // 4+ rooms
    }
  } else {
    // IF, PA, PS - shorter durations
    switch (rooms) {
      case 1: durationMinutes = 35; break;
      case 2: durationMinutes = 45; break;
      case 3: durationMinutes = 45; break;
      case 4: durationMinutes = 50; break;
      case 5: durationMinutes = 60; break;
      case 6:
      default: durationMinutes = 65; // 6+ rooms
    }
  }

  // Add 5 minutes if Note contains "DYMO" and type is IF or PS
  let note = "";
  if (raw) {
    // Handle both parsed JSON and string cases
    const rawData = typeof raw === "string" ? JSON.parse(raw) : raw;
    note = rawData?.Note || "";
  }
  
  if (note.toUpperCase().includes("DYMO") && (type === "IF" || type === "PS")) {
    durationMinutes += 5;
  }

  return durationMinutes;
}

/**
 * Calculate end time given a start time and inspection parameters
 * @param startTime - Start time in HH:mm format
 * @param params - Inspection parameters for duration calculation
 * @returns End time in HH:mm format
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
 * Add minutes to a time string
 * @param time - Time in HH:mm format
 * @param minutes - Minutes to add
 * @returns New time in HH:mm format
 */
export function addMinutesToTime(time: string, minutes: number): string {
  const [hours, mins] = time.split(":").map(Number);
  const date = new Date();
  date.setHours(hours, mins, 0, 0);
  date.setMinutes(date.getMinutes() + minutes);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}
