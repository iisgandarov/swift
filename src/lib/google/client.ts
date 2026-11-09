import "server-only";
import type { Item } from "@/lib/domain/types";
import type { AppContext } from "@/lib/server/context";

export interface CalendarClient {
  createEvent(item: Item): Promise<string>;
  /** Returns "gone" when the event no longer exists in Google (404/410). */
  updateEvent(googleId: string, item: Item): Promise<"ok" | "gone">;
  deleteEvent(googleId: string): Promise<void>;
}

/** Returns a calendar client for the user, or null when Google Calendar isn't connected. (Implemented in milestone 5.) */
export async function getCalendarClient(_ctx: AppContext): Promise<CalendarClient | null> {
  return null;
}
