import { format, parseISO } from "date-fns";

export function formatDateForDisplay(dateString: string): string {
  try {
    const date = parseISO(dateString);
    return format(date, "dd/MM/yyyy");
  } catch (error) {
    console.error("Failed to format date:", error);
    return dateString;
  }
}

export function formatDateForInput(dateString: string): string {
  try {
    const date = parseISO(dateString);
    return format(date, "yyyy-MM-dd");
  } catch (error) {
    console.error("Failed to format date for input:", error);
    return dateString;
  }
}

export function getCurrentDateForInput(): string {
  return format(new Date(), "yyyy-MM-dd");
}