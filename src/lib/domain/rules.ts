/**
 * Task vs Event rules (brief §5). Pure functions, no I/O.
 *  - Specific clock time → event. No time → task.
 *  - Event without an end → default duration from settings.
 *  - Task → event creates the Google event; event → task deletes it.
 *  - Editing an event's title/time/notes updates Google; marking done is app-only.
 */
import { addDays, addMinutesToTime, localToUtcIso, timeToMinutes, utcToLocal } from "@/lib/dates";
import type { Item, ItemType, LocalDate, LocalTime } from "./types";
import type { ItemInput, ItemPatch } from "./schemas";

export class RuleError extends Error {
  constructor(public code: "event_needs_date" | "event_needs_time", message?: string) {
    super(message ?? code);
  }
}

export interface RuleContext {
  timezone: string;
  defaultEventMinutes: number;
}

/** Type the app suggests from what we know: a clock time means event. */
export function suggestType(startTime: string | null | undefined): ItemType {
  return startTime ? "event" : "task";
}

export type TimingFields = Pick<Item, "type" | "date" | "start_at" | "end_at" | "all_day">;

/**
 * Normalises the timing part of an item into DB columns.
 * Tasks keep only a date (deadline); events get start_at/end_at in UTC.
 */
export function resolveTiming(
  input: {
    type: ItemType;
    date?: LocalDate | null;
    start_time?: LocalTime | null;
    end_time?: LocalTime | null;
    duration_minutes?: number | null;
    all_day?: boolean;
  },
  ctx: RuleContext,
): TimingFields {
  const date = input.date ?? null;

  if (input.type === "task") {
    return { type: "task", date, start_at: null, end_at: null, all_day: false };
  }

  if (!date) throw new RuleError("event_needs_date");

  if (input.all_day) {
    return { type: "event", date, start_at: null, end_at: null, all_day: true };
  }
  if (!input.start_time) throw new RuleError("event_needs_time");

  const start_at = localToUtcIso(date, input.start_time, ctx.timezone);
  let endDate = date;
  let endTime: LocalTime;

  if (input.end_time) {
    endTime = input.end_time;
    // an end earlier than the start means the event runs past midnight
    if (timeToMinutes(endTime) <= timeToMinutes(input.start_time)) endDate = addDays(date, 1);
  } else {
    const minutes = input.duration_minutes ?? ctx.defaultEventMinutes;
    const r = addMinutesToTime(input.start_time, minutes);
    endTime = r.time;
    endDate = addDays(date, r.dayOffset);
  }

  return {
    type: "event",
    date,
    start_at,
    end_at: localToUtcIso(endDate, endTime, ctx.timezone),
    all_day: false,
  };
}

/** Local view of an item's timing, for forms. */
export function localTiming(item: Pick<Item, "date" | "start_at" | "end_at">, timezone: string) {
  return {
    date: item.date,
    start_time: item.start_at ? utcToLocal(item.start_at, timezone).time : null,
    end_time: item.end_at ? utcToLocal(item.end_at, timezone).time : null,
  };
}

/** Builds the full set of columns for a new item. */
export function buildNewItem(input: ItemInput, ctx: RuleContext) {
  const timing = resolveTiming(input, ctx);
  return {
    ...timing,
    title: input.title.trim(),
    notes: input.notes?.trim() || null,
    priority: input.priority,
    category_id: input.category_id ?? null,
    status: "open" as const,
    completed_at: null,
    source: input.source,
    raw_transcript: input.raw_transcript ?? null,
    language: input.language ?? null,
    sync_status: timing.type === "event" ? ("pending" as const) : ("none" as const),
  };
}

/**
 * Applies a patch to an existing item. Missing timing fields are taken from the
 * current item, so "change date" keeps the event's time, etc.
 */
export function applyPatch(current: Item, patch: ItemPatch, ctx: RuleContext, now = new Date()) {
  const cur = localTiming(current, ctx.timezone);
  const touchesTiming =
    patch.type !== undefined ||
    patch.date !== undefined ||
    patch.start_time !== undefined ||
    patch.end_time !== undefined ||
    patch.duration_minutes !== undefined ||
    patch.all_day !== undefined;

  const out: Partial<Item> = {};
  if (patch.title !== undefined) out.title = patch.title.trim();
  if (patch.notes !== undefined) out.notes = patch.notes?.trim() || null;
  if (patch.priority !== undefined) out.priority = patch.priority;
  if (patch.category_id !== undefined) out.category_id = patch.category_id ?? null;

  if (touchesTiming) {
    const type = patch.type ?? current.type;
    const startTime = patch.start_time !== undefined ? patch.start_time : cur.start_time;
    // keep the previous duration when only the start moves
    let endTime = patch.end_time !== undefined ? patch.end_time : cur.end_time;
    let duration = patch.duration_minutes ?? null;
    if (patch.start_time !== undefined && patch.end_time === undefined && current.start_at && current.end_at) {
      duration = Math.round((new Date(current.end_at).getTime() - new Date(current.start_at).getTime()) / 60000);
      endTime = null;
    }
    Object.assign(
      out,
      resolveTiming(
        {
          type,
          date: patch.date !== undefined ? patch.date : cur.date,
          start_time: startTime,
          end_time: endTime,
          duration_minutes: duration,
          all_day: patch.all_day ?? (patch.start_time ? false : current.all_day),
        },
        ctx,
      ),
    );
  }

  if (patch.status !== undefined && patch.status !== current.status) {
    out.status = patch.status;
    out.completed_at = patch.status === "done" ? now.toISOString() : null;
  }
  return out;
}

export type SyncAction = "create" | "update" | "delete" | "none";

const SYNCED_FIELDS = ["title", "notes", "date", "start_at", "end_at", "all_day"] as const;

/** What has to happen in Google Calendar after an item changed. */
export function planSync(before: Item | null, after: Item | null): SyncAction {
  if (!after) {
    return before?.type === "event" && before.google_event_id ? "delete" : "none";
  }
  const wasEvent = before?.type === "event";
  if (after.type === "task") {
    return wasEvent && before?.google_event_id ? "delete" : "none";
  }
  // after is an event
  if (!after.google_event_id) return "create";
  if (!before || !wasEvent) return "create";
  const changed = SYNCED_FIELDS.some((f) => before[f] !== after[f]);
  return changed ? "update" : "none";
}

/** Overdue = open task/event whose day is before today (events: whose end is in the past and day before today). */
export function isOverdue(item: Pick<Item, "status" | "date">, today: LocalDate) {
  return item.status === "open" && item.date !== null && item.date < today;
}
