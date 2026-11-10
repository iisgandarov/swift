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
  // a specific clock time always makes it an event (brief §5)
  let type: ItemType = p.start_time ? "event" : p.type;
  let date = p.date;
  let start = p.start_time;
  let end: string | null = null;

  if (type === "event" && !start) {
    // the model said "event" but gave no time: keep it as a task and ask
    type = "task";
    uncertain.add("time");
    uncertain.add("type");
  }
  if (type === "event") {
    if (!date) {
      date = opts.today;
      uncertain.add("date");
    }
    end = p.end_time ?? addMinutesToTime(start!, p.duration_minutes ?? opts.defaultEventMinutes).time;
  } else {
    start = null;
  }

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
    start_time: d.type === "event" ? d.start : null,
    end_time: d.type === "event" ? d.end : null,
    priority: d.priority,
    category_id: d.categoryId,
    source: meta.source,
    raw_transcript: meta.transcript,
    language: meta.language,
  };
}

/** A draft can be saved when it has a title and, for events, a date and time. */
export function draftIsValid(d: Draft) {
  return d.title.trim().length > 0 && (d.type === "task" || Boolean(d.date && d.start));
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
    if (m.start) {
      Object.assign(out, { type: "event", start: m.start, end: m.end, date: out.date ?? m.date });
    } else {
      Object.assign(out, { type: "task", start: null, end: null });
    }
    resolve("time", "type");
  } else if (m.touched.has("type")) {
    // switching to Event only works with a time; keep the AI's time if it found one
    if (m.type === "task") Object.assign(out, { type: "task", start: null, end: null });
    else if (out.start) out.type = "event";
    resolve("type");
  }
  if (m.touched.has("category")) {
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
