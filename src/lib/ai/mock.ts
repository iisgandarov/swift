import { addDays, startOfWeek, weekdayIndex } from "@/lib/dates";
import { categoryNameFor } from "@/lib/domain/categorize";
import type { AiProvider, AudioInput, ParseContext, ParseResult, ParsedItem } from "./schema";

/**
 * Offline stand-in for the real model, used in demo mode and when no API key is set.
 * It understands a useful subset of phrases so the whole flow can be tried without keys.
 * It is deliberately simple — the real parsing lives in the LLM prompt.
 */
const SAMPLES = {
  az: "Sabah saat 10-da Ramizlə EduPo demo görüşü, bir də TLB üçün post yazmaq",
  en: "Tomorrow at 3pm call with the client, and also finish the Power BI report by Friday, it's urgent",
};

const AZ_WEEKDAYS: [RegExp, number][] = [
  [/bazar ertəsi/, 0], [/çərşənbə axşamı/, 1], [/cümə axşamı/, 3], [/çərşənbə/, 2], [/cümə/, 4], [/şənbə/, 5], [/bazar/, 6],
];
const EN_WEEKDAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

const FILLER = [
  /xatırlat ki/g, /yadıma sal/g, /\bolacaq\b/g, /\bqeyd et\b/g, /\bonu\b/g, /yadımda saxla/g, /remind me to/g, /i need to/g, /don't forget to/g, /lazımdır/g,
  /,?\s*(təcilidir|təcili|vacibdir|vacib|mütləq|urgent|asap|it's urgent|important)/g,
];

function nextWeekday(today: string, target: number, nextWeek: boolean) {
  if (nextWeek) return addDays(startOfWeek(today), 7 + target);
  const diff = (target - weekdayIndex(today) + 7) % 7;
  return addDays(today, diff);
}

function parseOne(raw: string, ctx: ParseContext, carryDate: string | null): ParsedItem {
  let s = ` ${raw.toLowerCase().trim()} `;
  const today = ctx.localDate;
  let date: string | null = null;
  let start: string | null = null;
  let duration: number | null = null;
  const uncertain: ParsedItem["uncertain_fields"] = [];

  // dates
  if (/\bbirigün\b|day after tomorrow/.test(s)) date = addDays(today, 2);
  else if (/\bsabah\b|\btomorrow\b/.test(s)) date = addDays(today, 1);
  else if (/\bbu gün\b|\btoday\b|bu axşam|tonight/.test(s)) date = today;
  for (const [re, idx] of AZ_WEEKDAYS) {
    if (re.test(s)) {
      date = nextWeekday(today, idx, /gələn/.test(s));
      s = s.replace(re, " ");
      break;
    }
  }
  EN_WEEKDAYS.forEach((d, idx) => {
    if (s.includes(d)) {
      date = nextWeekday(today, idx, new RegExp(`next ${d}`).test(s));
      s = s.replace(new RegExp(`(by |next |this |on )?${d}`), " ");
    }
  });
  const days = s.match(/(\d+) gündən sonra|in (\d+) days/);
  if (days) date = addDays(today, Number(days[1] ?? days[2]));

  // times
  const ampm = s.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/);
  // \b doesn't work after Azerbaijani letters (ə, ü), so use an explicit end lookahead
  // "-də/-da" is often typed with a Latin "e" ("7de") — accept both
  const az = s.match(/(?:saat\s*)?(\d{1,2})(?:[:.](\d{2}))?-?(?:da|də|de|ə|e|a|ün|un)(?=[\s,.]|$)/) ?? s.match(/saat\s*(\d{1,2})(?:[:.](\d{2}))?/);
  let bareMorning = false; // an hour 7–11 read as morning only because nothing said otherwise
  if (ampm) {
    let h = Number(ampm[1]) % 12;
    if (ampm[3] === "pm") h += 12;
    start = `${String(h).padStart(2, "0")}:${ampm[2] ?? "00"}`;
  } else if (az) {
    let h = Number(az[1]);
    const evening = /axşam|gecə|günortadan sonra|evening|tonight/.test(s);
    const morning = /səhər|morning/.test(s);
    if (evening && h < 12) h += 12;
    else if (!morning && h >= 1 && h <= 6) {
      h += 12;
      uncertain.push("time");
    } else if (!morning && h >= 7 && h <= 11) bareMorning = true;
    start = `${String(h).padStart(2, "0")}:${az[2] ?? "00"}`;
  } else if (/\bgünorta\b|\bnoon\b/.test(s)) {
    start = "12:00";
  }
  if (/yarım saat|half an hour|30 min/.test(s)) duration = 30;
  else if (/(1|bir) saatlıq|one hour|1 hour/.test(s)) duration = 60;

  const priority: ParsedItem["priority"] = /təcili|vacib|mütləq|urgent|asap|important/.test(s) ? "high" : "medium";
  // every item gets a category: own category by name, else Meeting / Work / Personal
  const category = categoryNameFor(raw, ctx.categories);

  // title: drop date/time words and filler, keep the rest
  let title = s.replace(/(\p{L}+?)(məliyəm|malıyam)\b/gu, "$1");
  for (const re of FILLER) title = title.replace(re, " ");
  title = title
    .replace(/\b(bu gün|sabah|birigün|tomorrow|today|day after tomorrow|bu axşam|tonight|gələn|next|this|by|on|at)\b/g, " ")
    .replace(/(saat\s*)?\d{1,2}([:.]\d{2})?\s*(am|pm|-?(da|də|de|ə|e|a|ün|un))?(?=[\s,.]|$)/g, " ")
    .replace(/\b(səhər|axşam|gecə|günortadan sonra|günorta|afternoon|morning|evening)\b/g, " ")
    .replace(/\b(yarım saatlıq|yarım saat|bir saatlıq|1 saatlıq|half an hour|one hour)\b/g, " ")
    .replace(/\b(gününə qədər|qədər)\b/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^[\s,.-]+|[\s,.-]+$/g, "");
  // restore the original casing of each word (brand names like EduPo, TLB)
  const original = new Map(raw.split(/[\s,.]+/).map((w) => [w.toLocaleLowerCase("az"), w]));
  const words = title
    .split(" ")
    .slice(0, 6)
    .map((w) => original.get(w) ?? w)
    .join(" ");
  const finalTitle = words ? words[0].toLocaleUpperCase(ctx.uiLocale === "az" ? "az" : "en") + words.slice(1) : raw.trim();

  let effectiveDate = date ?? (start ? carryDate ?? today : carryDate);
  // no day given and that time is already past today: a bare morning hour means the evening
  // if that is still ahead ("saat 7" at 17:20 → 19:00), otherwise it is tomorrow
  if (start && !date && !carryDate && ctx.localTime && start <= ctx.localTime) {
    const [h, m] = start.split(":");
    const evening = `${String(Number(h) + 12).padStart(2, "0")}:${m}`;
    if (bareMorning && evening > ctx.localTime) start = evening;
    else effectiveDate = addDays(today, 1);
    if (!uncertain.includes("time")) uncertain.push("time");
  }
  return {
    type: start ? "event" : "task",
    title: finalTitle,
    notes: /afternoon|günortadan sonra/.test(s) && !start ? (ctx.uiLocale === "az" ? "günortadan sonra" : "afternoon") : null,
    date: effectiveDate,
    start_time: start,
    end_time: null,
    duration_minutes: start ? duration : null,
    all_day: false,
    priority,
    category,
    confidence: uncertain.length ? 0.6 : 0.85,
    clarification: uncertain.includes("time") ? (ctx.uiLocale === "az" ? "Saat günün hansı vaxtıdır?" : "Which part of the day?") : null,
    uncertain_fields: uncertain,
  };
}

export function mockParse(text: string, ctx: ParseContext): ParseResult {
  const lower = text.toLowerCase();
  const isAz = /[əğıöüşç]|\b(sabah|saat|bir də|görüş)\b/.test(lower);
  const parts = text
    .split(/,?\s*(?:bir də|sonra da|həm də|and also|and then|also)\s+/i)
    .map((p) => p.trim())
    .filter((p) => p.length > 1);
  const items: ParsedItem[] = [];
  let carry: string | null = null;
  for (const p of parts) {
    const it = parseOne(p, ctx, carry);
    carry = it.date;
    if (it.title.length > 0) items.push(it);
  }
  return {
    detected_language: isAz ? "az" : "en",
    items,
    clarification: items.length ? null : isAz ? "Tapşırıq eşitmədim." : "I didn't catch a task.",
  };
}

export class MockProvider implements AiProvider {
  readonly name = "mock";
  async transcribe(_audio: File, lang?: "az" | "en") {
    await new Promise((r) => setTimeout(r, 600));
    const language = lang ?? "az";
    return { text: SAMPLES[language], language };
  }
  async parseAudio(_audio: AudioInput, ctx: ParseContext, opts: { lang?: "az" | "en" } = {}) {
    await new Promise((r) => setTimeout(r, 600));
    const transcript = SAMPLES[opts.lang ?? "az"];
    return JSON.stringify({ transcript, ...mockParse(transcript, ctx) });
  }

  async parseItems(text: string, ctx: ParseContext) {
    await new Promise((r) => setTimeout(r, 300));
    return JSON.stringify(mockParse(text, ctx));
  }
}
