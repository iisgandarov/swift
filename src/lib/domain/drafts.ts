/**
 * AI output → editable drafts for the confirmation sheet → item inputs for the API.
 * Pure functions so they can be unit-tested with mocked model responses.
 */
import { addMinutesToTime } from "@/lib/dates";
import type { ParsedItem, ParseResult } from "@/lib/ai/schema";
import type { Category, ItemType, Priority } from "./types";
import type { ItemInput } from "./schemas";
import { categoryNameFor } from "./categorize";

export type UncertainField = ParsedItem["uncertain_fields"][number];

export interface Draft {
  key: string;
  type: ItemType;
  title: string;
  notes: string;
  date: string | null;
  start: string | null;
  end: string | null;
  priority: Priority;
  categoryId: string | null;
  confidence: number;
  clarification: string | null;
  uncertain: UncertainField[];
}

const norm = (s: string) => s.trim().toLocaleLowerCase("az").normalize("NFC");

export function matchCategory(name: string | null, categories: Category[]): string | null {
  if (!name) return null;
  const n = norm(name);
  const exact = categories.find((c) => norm(c.name_az) === n || norm(c.name_en) === n);
  if (exact) return exact.id;
  const partial = categories.find(
    (c) => norm(c.name_az).startsWith(n) || norm(c.name_en).startsWith(n) || n.startsWith(norm(c.name_en)) || n.startsWith(norm(c.name_az)),
  );
  return partial?.id ?? null;
}

export function draftFromParsed(
  p: ParsedItem,
  opts: { categories: Category[]; defaultEventMinutes: number; today: string; key: string },
): Draft {
  const uncertain = new Set<UncertainField>(p.uncertain_fields);
  // the type comes from the model (user choice, explicit words, meeting/call → event);
  // a clock time alone does NOT make an event: tasks may have a time
  let type: ItemType = p.type;
  let date = p.date;
  const start = p.start_time;
  let end: string | null = null;

  if (type === "event" && !start) {
    // the model said "event" but gave no time: keep it as a task and ask
    type = "task";
    uncertain.add("time");
    uncertain.add("type");
  }
  if (start && !date) {
    date = opts.today;
    uncertain.add("date");
  }
  if (type === "event") end = p.end_time ?? addMinutesToTime(start!, p.duration_minutes ?? opts.defaultEventMinutes).time;

  return {
    key: opts.key,
    type,
    title: p.title.trim().slice(0, 200),
    notes: p.notes?.trim() ?? "",
    date,
    start,
    end,
    priority: p.priority,
    // never empty: the AI's choice, else the same rules on the item's own words
    categoryId:
      matchCategory(p.category, opts.categories) ??
      matchCategory(categoryNameFor(`${p.title} ${p.notes ?? ""}`, opts.categories.flatMap((c) => [c.name_az, c.name_en])), opts.categories),
    confidence: p.confidence,
    clarification: p.clarification,
    uncertain: [...uncertain],
  };
}

export function draftsFromResult(
  result: Pick<ParseResult, "items">,
  opts: { categories: Category[]; defaultEventMinutes: number; today: string },
): Draft[] {
  return result.items.map((p, i) => draftFromParsed(p, { ...opts, key: `d${i}-${p.title}` }));
}

export function draftToInput(
  d: Draft,
  meta: { source: "voice" | "text"; transcript: string | null; language: "az" | "en" | null },
): ItemInput {
  return {
    type: d.type,
    title: d.title.trim(),
    notes: d.notes.trim() || null,
    date: d.date,
    start_time: d.start,
    end_time: d.type === "event" ? d.end : null,
    priority: d.priority,
    category_id: d.categoryId,
    source: meta.source,
    raw_transcript: meta.transcript,
    language: meta.language,
  };
}

/** A draft can be saved when it has a title, a date for any time, and for events a date and time. */
export function draftIsValid(d: Draft) {
  if (!d.title.trim()) return false;
  if (d.start && !d.date) return false;
  return d.type === "task" || Boolean(d.date && d.start);
}

/** Fields the user set by hand in the form; they always win over what the AI suggested. */
export interface ManualChoices {
  touched: ReadonlySet<"date" | "time" | "type" | "category" | "priority" | "notes">;
  date: string | null;
  start: string | null;
  end: string | null;
  type: ItemType;
  categoryId: string | null;
  priority: Priority;
  notes: string;
}

export function applyManualChoices(d: Draft, m: ManualChoices): Draft {
  const out: Draft = { ...d, uncertain: [...d.uncertain] };
  const resolve = (...f: UncertainField[]) => (out.uncertain = out.uncertain.filter((u) => !f.includes(u)));
  if (m.touched.has("date")) {
    out.date = m.date;
    resolve("date");
  }
  if (m.touched.has("time")) {
    // a time set by hand is kept as is; it no longer decides the type
    Object.assign(out, { start: m.start, end: m.start && out.type === "event" ? m.end : null, date: m.start ? (out.date ?? m.date) : out.date });
    resolve("time");
  }
  if (m.touched.has("type")) Object.assign(out, withType(out, m.type));
  if (m.touched.has("type")) resolve("type");  if (m.touched.has("category")) {
    out.categoryId = m.categoryId;
    resolve("category");
  }
  if (m.touched.has("priority")) {
    out.priority = m.priority;
    resolve("priority");
  }
  if (m.touched.has("notes") && m.notes.trim()) out.notes = m.notes;
  return out;
}

/**
 * The draft as the given type, keeping its date and time. An event without a time stays an
 * event (the user chose it) with the time flagged, so it can't be saved until a time is set.
 */
export function withType(d: Draft, type: ItemType): Draft {
  const out: Draft = { ...d, type, uncertain: d.uncertain.filter((u) => u !== "type") };
  if (type === "task") out.end = null;
  else if (!d.start && !out.uncertain.includes("time")) out.uncertain = [...out.uncertain, "time"];
  return out;
}
