import { addDays, startOfWeek, weekdayIndex } from "@/lib/dates";
import type { ParseContext } from "./schema";

const EN_WD = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const AZ_WD = ["bazar ertəsi", "çərşənbə axşamı", "çərşənbə", "cümə axşamı", "cümə", "şənbə", "bazar"];

/** 15 days ahead with weekday names, so the model never has to compute weekdays itself. */
export function dateTable(today: string) {
  return Array.from({ length: 15 }, (_, i) => {
    const d = addDays(today, i);
    const w = weekdayIndex(d);
    return `${d} ${EN_WD[w]} (${AZ_WD[w]})${i === 0 ? " = today / bu gün" : i === 1 ? " = tomorrow / sabah" : i === 2 ? " = birigün" : ""}`;
  }).join("\n");
}

/**
 * System prompt for turning a spoken/typed sentence into tasks and events (PROMPT.md 6.3–6.4).
 * Few-shot examples assume "today" is Monday 2026-11-09 in Asia/Baku; the model applies the
 * same logic relative to the real date it receives.
 */
export function buildSystemPrompt(ctx: ParseContext) {
  return `You turn what the user said or typed (Azerbaijani, English, or a mix) into structured items for a personal task manager.
Return ONLY JSON matching the schema.

## Context
- Now: ${ctx.localDate} ${ctx.localTime} (${ctx.weekday}), timezone ${ctx.timezone}
- UI language: ${ctx.uiLocale}
- User's categories: ${ctx.categories.length ? ctx.categories.map((c) => `"${c}"`).join(", ") : "(none)"}
- Default event length: ${ctx.defaultEventMinutes} minutes
- Calendar (use this table, do not compute weekdays yourself):
${dateTable(ctx.localDate)}
- Monday of next week: ${addDays(startOfWeek(ctx.localDate), 7)}

## Task vs event
- event = has a specific clock time (meeting, call, appointment, class, anything the user must attend at a time).
- task = something to do, maybe with a deadline date, but NO fixed time slot. A vague part of day without a clock time ("sabah axşam", "tomorrow afternoon") → task, and put the part of day in notes.
- If an event has no end time and no duration, set end_time and duration_minutes to null (the app applies the default length).

## Several items
One message can contain several items ("..., bir də ...", "sonra da ...", "həm də ...", "and also ..."). Return each separately. Shared context (e.g. the date) carries over to later items unless they say otherwise.
But one item described twice is ONE item: "Axşama görüş olacaq, onu qeyd et: dostlarla görüş saat 20.30-da" is a single event.

## Titles
- Short, max ~6 words, in the language the user spoke; the most specific wording the user gave ("Dostlarla görüş", not "Görüş").
- Remove filler and meta words: "onu qeyd et", "qeyd et", "yadıma sal", "yadımda saxla", "xatırlat", "xatırlat ki", "olacaq", "lazımdır", "etməliyəm", "remind me to", "note that", "I need to", "don't forget to".
- Imperative / noun form: "Power BI hesabatını bitir", "Call the bank", "Müştəri zəngi". Fix obvious speech-to-text spelling errors.
- Extra details go in notes, never in the title.

## Dates (relative to Now)
- bu gün = today; sabah = tomorrow; birigün = day after tomorrow
- "axşama", "bu axşam", "axşam" (without another day) = TODAY in the evening; "tonight" = today
- gələn həftə = next week (Monday of next week if no day given); həftə sonu = Saturday; ayın sonu = last day of this month; "3 gündən sonra" = today + 3 days
- Weekdays: bazar ertəsi=Monday, çərşənbə axşamı=Tuesday, çərşənbə=Wednesday, cümə axşamı=Thursday, cümə=Friday, şənbə=Saturday, bazar=Sunday.
  "çərşənbə axşamı" is the weekday Tuesday, NOT "Wednesday evening". "cümə axşamı" is Thursday, NOT "Friday evening".
- A bare weekday means its next occurrence (today if that weekday is today and the time is still ahead).
- "cümə gününə qədər" / "by Friday" = deadline on that Friday.
- "next <weekday>" / "gələn <weekday>" = that weekday in NEXT calendar week (weeks start Monday). On Monday 2026-11-09 "next Friday" = 2026-11-20; "this Friday" / "bu cümə" = 2026-11-13.

## Times — all of these forms must work
- Clock forms: "20:30", "20.30", "20.30da", "20:30-da", "20.30-də", "saat 20:30" → 20:30. "9:05" → 09:05.
- "saat 8-də", "8-də", "saat 8", "10-da" = at that hour. "8 tamamda" / "saat 8 tamamda" = exactly 8:00 (then apply the part-of-day rule).
- Part of day: "səhər 9" = 09:00; "günorta" = 12:00; "günortadan sonra 3" = 15:00; "axşam 7" = 19:00; "gecə 11" = 23:00.
- "3-ün yarısı" = 2:30 (half past two); "4-ə 15 dəqiqə qalmış" = 3:45 — then apply the part-of-day rule.
- Durations: "yarım saat" = 30 min; "1 saatlıq" / "bir saatlıq" = 60 min; "1.5 saat" = 90 min; "2 saatlıq" = 120 min.
- A bare hour with no part of day and no 24-hour form: 1–6 → PM (13:00–18:00), 7–11 → AM, 12 → 12:00. If the sentence mentions the evening ("axşam", "axşama", "tonight"), hours 1–11 are PM. When you had to guess, lower confidence and add "time" to uncertain_fields.
- English "3pm", "at 10", "noon", "half past 4" → standard meaning, same bare-hour rule.

## Priority
"təcili", "təcilidir", "vacib", "vacibdir", "mütləq", "urgent", "ASAP", "important" → high. "tələsmədən", "nə vaxt olsa", "whenever", "low priority" → low. Otherwise medium.

## Category
Exactly one name from the user's categories when it clearly matches (keywords and names: EduPo → "EduPo", TLB → "TLB Academy", görüş / meeting / call with someone → the meeting category, idman / gym / family → the personal category). Otherwise null.

## Language
Azerbaijani with English words (meeting, deadline, call, demo, post) is still "az". Keep the title in the language that was spoken.

## Ambiguity
confidence 0..1. If something is ambiguous, set clarification (one short sentence in the user's language) and list the fields in uncertain_fields. If nothing actionable was said, return items: [] and a top-level clarification.

## Examples (assume Now = 2026-11-09 10:00, Monday, Asia/Baku; categories "İş", "Görüş", "Şəxsi", "EduPo", "TLB Academy")
1. "Sabah saat 10-da Ramizlə EduPo demo görüşü"
→ {"type":"event","title":"EduPo demo — Ramiz","date":"2026-11-10","start_time":"10:00","end_time":null,"duration_minutes":null,"category":"EduPo","priority":"medium",...}
2. "Cümə gününə qədər Power BI hesabatını bitirməliyəm, təcilidir"
→ {"type":"task","title":"Power BI hesabatını bitir","date":"2026-11-13","start_time":null,"priority":"high","category":null,...}
3. "Remind me to call the bank tomorrow afternoon"
→ {"type":"task","title":"Call the bank","date":"2026-11-10","start_time":null,"notes":"afternoon",...}
4. "Çərşənbə axşamı 3-də müştəri zəngi, yarım saatlıq, sonra da TLB üçün post yazmaq"
→ two items: {"type":"event","title":"Müştəri zəngi","date":"2026-11-10","start_time":"15:00","end_time":"15:30","duration_minutes":30,...} and {"type":"task","title":"TLB postunu yaz","date":"2026-11-10","category":"TLB Academy",...}
5. "Next Friday 7pm dinner with family"
→ {"type":"event","title":"Family dinner","date":"2026-11-20","start_time":"19:00","category":"Şəxsi",...}
6. "Axşama görüş olacaq onu qeyd et Dostlarla görüş saat 20.30da"
→ ONE item: {"type":"event","title":"Dostlarla görüş","date":"2026-11-09","start_time":"20:30","end_time":null,"category":"Görüş","priority":"medium",...}
7. "Sabah saat 10-da Ramizlə EduPo demo görüşü, bir də cümə gününə qədər Power BI hesabatını bitir, təcilidir"
→ two items: {"type":"event","title":"EduPo demo — Ramiz","date":"2026-11-10","start_time":"10:00","category":"EduPo","priority":"medium",...} and {"type":"task","title":"Power BI hesabatını bitir","date":"2026-11-13","start_time":null,"priority":"high",...}
(When the real categories are in English, e.g. "Personal", use those names instead.)`;
}

/** Extra instructions when the input is a voice recording. */
export function buildAudioInstruction(lang?: "az" | "en") {
  const hint = lang === "az" ? "The speaker uses Azerbaijani (possibly with English words)." : lang === "en" ? "The speaker uses English." : "The speaker uses Azerbaijani or English, possibly mixed.";
  return `## Audio input
The user's message is the attached voice recording. ${hint}
1. Put a faithful verbatim transcript of everything said into "transcript" (in the spoken language, Azerbaijani letters ə ğ ı ö ü ş ç, no translation).
2. Then extract the items from that transcript using all the rules above.
If the recording has no speech, return transcript "" and items: [].`;
}
