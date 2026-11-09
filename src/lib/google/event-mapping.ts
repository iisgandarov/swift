import { addDays, DEFAULT_TZ, utcToLocal } from "@/lib/dates";
import type { Item } from "@/lib/domain/types";

export const SWIFT_SIGNATURE = "Created with Swift";

export interface GoogleEventBody {
  summary: string;
  description: string;
  start: { dateTime?: string; date?: string; timeZone?: string };
  end: { dateTime?: string; date?: string; timeZone?: string };
  reminders: { useDefault: boolean };
  extendedProperties: { private: { swiftItemId: string } };
}

/** Swift item → Google Calendar event body (title, notes + signature, start/end in the user's timezone). */
export function toGoogleEvent(item: Item, tz: string = DEFAULT_TZ): GoogleEventBody {
  const description = item.notes ? `${item.notes}\n\n${SWIFT_SIGNATURE}` : SWIFT_SIGNATURE;
  const base = {
    summary: item.title,
    description,
    reminders: { useDefault: true },
    extendedProperties: { private: { swiftItemId: item.id } },
  };
  if (item.all_day || !item.start_at) {
    const date = item.date!;
    return { ...base, start: { date }, end: { date: addDays(date, 1) } };
  }
  const end = item.end_at ?? item.start_at;
  const s = utcToLocal(item.start_at, tz);
  const e = utcToLocal(end, tz);
  return {
    ...base,
    start: { dateTime: `${s.date}T${s.time}:00`, timeZone: tz },
    end: { dateTime: `${e.date}T${e.time}:00`, timeZone: tz },
  };
}

/** Read-only view of an event that lives in Google Calendar. */
export interface GoogleEventLite {
  id: string;
  title: string;
  /** local date (user tz) the event starts on */
  date: string;
  start_at: string | null; // ISO, null for all-day
  end_at: string | null;
  all_day: boolean;
  html_link: string | null;
  color: string | null;
}

interface RawGoogleEvent {
  id: string;
  status?: string;
  summary?: string;
  htmlLink?: string;
  colorId?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
}

export function fromGoogleEvent(e: RawGoogleEvent, tz: string = DEFAULT_TZ): GoogleEventLite | null {
  if (e.status === "cancelled" || !e.start) return null;
  const allDay = Boolean(e.start.date);
  const start_at = e.start.dateTime ? new Date(e.start.dateTime).toISOString() : null;
  const end_at = e.end?.dateTime ? new Date(e.end.dateTime).toISOString() : null;
  return {
    id: e.id,
    title: e.summary?.trim() || "(—)",
    date: allDay ? e.start.date! : utcToLocal(start_at!, tz).date,
    start_at,
    end_at,
    all_day: allDay,
    html_link: e.htmlLink ?? null,
    color: e.colorId ?? null,
  };
}
