import { parseResultSchema, UNCERTAIN_FIELDS, type ParsedItem, type ParseResult } from "./schema";
import { cleanTitle } from "@/lib/domain/title";

/**
 * Turns whatever Gemini answered into a valid ParseResult, field by field. Small format
 * differences are repaired ("9:00" → "09:00", "17:00:00" → "17:00", confidence 85 → 0.85, a
 * missing field → null). A field that can't be repaired is dropped (null) and flagged in
 * uncertain_fields so the confirmation sheet highlights it. An item is dropped only when it has
 * no usable title; the whole answer is rejected only when it isn't JSON at all.
 *
 * The AI contract tests (tests/unit/ai-contract.test.ts) pin this behaviour down.
 */
export interface Repaired {
  result: ParseResult;
  /** what had to be fixed, for the server log */
  repairs: string[];
}

type Uncertain = (typeof UNCERTAIN_FIELDS)[number];
const pad = (n: number) => String(n).padStart(2, "0");

/** Extracts the JSON object from a model answer (code fences, text around it). null = no JSON. */
export function extractJson(raw: string): unknown {
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.search(/[[{]/);
    const end = Math.max(cleaned.lastIndexOf("}"), cleaned.lastIndexOf("]"));
    if (start === -1 || end <= start) return null;
    try {
      return JSON.parse(cleaned.slice(start, end + 1));
    } catch {
      return null;
    }
  }
}

/** "9:00", "09:00:00", "9.30", "21", "9pm", "9:30 PM" → "HH:mm"; anything else → null. */
export function repairTime(v: unknown): string | null {
  if (typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= 23) return `${pad(v)}:00`;
  if (typeof v !== "string") return null;
  const s = v.trim().toLowerCase();
  const m = s.match(/^(\d{1,2})(?:[:.](\d{2}))?(?::\d{2}(?:\.\d+)?)?\s*(am|pm|a\.m\.|p\.m\.)?$/) ?? s.match(/T(\d{2}):(\d{2})/i);
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2] ?? 0);
  const ampm = m[3]?.replace(/\./g, "");
  if (ampm === "pm" && h < 12) h += 12;
  if (ampm === "am" && h === 12) h = 0;
  if (h > 23 || min > 59) return null;
  return `${pad(h)}:${pad(min)}`;
}

/** "2026-11-10", "2026-11-10T17:00", "10.11.2026", "2026/11/10" → "YYYY-MM-DD"; else null. */
export function repairDate(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  let y: number, mo: number, d: number;
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:$|[T\s])/);
  if (m) [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  else if ((m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/))) [d, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
  else return null;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return `${y}-${pad(mo)}-${pad(d)}`;
}

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

function repairItem(raw: unknown, i: number, repairs: string[]): ParsedItem | null {
  if (!raw || typeof raw !== "object") {
    repairs.push(`item ${i + 1}: not an object, dropped`);
    return null;
  }
  const o = raw as Record<string, unknown>;
  const uncertain = new Set<Uncertain>();
  const note = (what: string) => repairs.push(`item ${i + 1}: ${what}`);

  // title — the one thing an item can't do without
  let title = str(o.title)?.replace(/^["“'«]+|["”'»]+$/g, "").trim() ?? null;
  const notes = str(o.notes);
  if (!title && notes) {
    title = notes.split(/\s+/).slice(0, 6).join(" ");
    note("title missing, taken from notes");
    uncertain.add("title");
  }
  if (!title) {
    note("no title, dropped");
    return null;
  }
  const cleaned = cleanTitle(title, "ai");
  if (cleaned !== title) {
    note(`title "${title}" → "${cleaned}"`);
    title = cleaned;
  }

  const typeRaw = typeof o.type === "string" ? o.type.trim().toLowerCase() : "";
  const type: ParsedItem["type"] = /^(event|tədbir|meeting|görüş)$/.test(typeRaw) ? "event" : "task";
  if (typeRaw !== "task" && typeRaw !== "event") {
    note(`type "${String(o.type)}" → ${type}`);
    uncertain.add("type");
  }

  const date = repairDate(o.date);
  if (o.date != null && o.date !== "" && !date) {
    note(`date "${String(o.date)}" dropped`);
    uncertain.add("date");
  } else if (date && date !== o.date) note(`date "${String(o.date)}" → ${date}`);

  let start = repairTime(o.start_time);
  if (!start && typeof o.date === "string" && /T\d{2}:\d{2}/.test(o.date)) start = repairTime(o.date); // time hidden in the date
  if (o.start_time != null && o.start_time !== "" && !start) {
    note(`start_time "${String(o.start_time)}" dropped`);
    uncertain.add("time");
  } else if (start && start !== o.start_time) note(`start_time "${String(o.start_time ?? o.date)}" → ${start}`);

  let end = repairTime(o.end_time);
  if (o.end_time != null && o.end_time !== "" && !end) note(`end_time "${String(o.end_time)}" dropped`);
  if (!start || type === "task") end = null;

  let duration: number | null = null;
  const dRaw = typeof o.duration_minutes === "string" ? Number(o.duration_minutes) : o.duration_minutes;
  if (typeof dRaw === "number" && Number.isFinite(dRaw)) {
    const r = Math.round(dRaw);
    duration = r >= 1 && r <= 24 * 60 ? r : null;
    if (duration === null && r !== 0) note(`duration ${dRaw} dropped`);
  }
  if (type === "task") duration = null;

  const pRaw = typeof o.priority === "string" ? o.priority.trim().toLowerCase() : "";
  const priority: ParsedItem["priority"] = /^(high|yüksək|urgent|təcili)$/.test(pRaw) ? "high" : /^(low|aşağı)$/.test(pRaw) ? "low" : "medium";
  if (pRaw && pRaw !== priority) note(`priority "${String(o.priority)}" → ${priority}`);

  const cRaw = typeof o.confidence === "string" ? Number(o.confidence) : o.confidence;
  let confidence = typeof cRaw === "number" && Number.isFinite(cRaw) ? cRaw : 0.7;
  if (confidence > 1 && confidence <= 100) confidence /= 100;
  confidence = Math.max(0, Math.min(1, confidence));

  const aliases: Record<string, Uncertain> = { start_time: "time", end_time: "time", duration: "time", duration_minutes: "time", start: "time", category_id: "category" };
  for (const f of Array.isArray(o.uncertain_fields) ? o.uncertain_fields : []) {
    const k = typeof f === "string" ? (aliases[f.trim().toLowerCase()] ?? f.trim().toLowerCase()) : "";
    if ((UNCERTAIN_FIELDS as readonly string[]).includes(k)) uncertain.add(k as Uncertain);
  }

  return {
    type,
    title: title.slice(0, 200),
    notes,
    date,
    start_time: start,
    end_time: end,
    duration_minutes: duration,
    all_day: o.all_day === true || o.all_day === "true",
    priority,
    category: str(o.category),
    confidence,
    clarification: str(o.clarification),
    uncertain_fields: [...uncertain],
  };
}

/** Repairs a model answer. null only when it contains no JSON at all (then the call is retried). */
export function repairParseResult(raw: string, opts: { audio?: boolean } = {}): Repaired | null {
  const json = extractJson(raw);
  if (json === null || typeof json !== "object") return null;
  const repairs: string[] = [];
  const top = (Array.isArray(json) ? { items: json } : json) as Record<string, unknown>;

  let rawItems: unknown[] = [];
  if (Array.isArray(top.items)) rawItems = top.items;
  else if (top.items && typeof top.items === "object") {
    rawItems = [top.items];
    repairs.push("items was a single object");
  } else if (top.title) {
    rawItems = [top];
    repairs.push("answer was a single item");
  } else if (top.items !== undefined) repairs.push("items not a list, ignored");

  const items = rawItems.slice(0, 20).map((it, i) => repairItem(it, i, repairs)).filter((x): x is ParsedItem => x !== null);
  const transcript = str(top.transcript);
  const sample = `${transcript ?? ""} ${items.map((i) => i.title).join(" ")}`;
  const lang = top.detected_language === "az" || top.detected_language === "en" ? top.detected_language : /[əğıöüşç]/i.test(sample) ? "az" : "en";
  if (lang !== top.detected_language) repairs.push(`detected_language "${String(top.detected_language)}" → ${lang}`);

  const result = parseResultSchema.parse({
    ...(opts.audio || transcript !== null ? { transcript: transcript ?? "" } : {}),
    detected_language: lang,
    items,
    clarification: str(top.clarification),
  });
  return { result, repairs };
}
