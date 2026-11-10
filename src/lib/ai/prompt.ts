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
 * Kept compact (it is sent with every request): every rule is one line, examples show only the
 * fields that matter. Few-shot examples assume "today" is Monday 2026-11-09 in Asia/Baku.
 */
export function buildSystemPrompt(ctx: ParseContext) {
  return `Turn what the user said or typed (Azerbaijani, English, or mixed) into items for a task manager. Return ONLY JSON matching the schema.

## Context
- Now: ${ctx.localDate} ${ctx.localTime} (${ctx.weekday}), timezone ${ctx.timezone}; UI language ${ctx.uiLocale}
- Categories: ${ctx.categories.length ? ctx.categories.map((c) => `"${c}"`).join(", ") : "(none)"}
- Default event length: ${ctx.defaultEventMinutes} min
- Calendar (use it, never compute weekdays):
${dateTable(ctx.localDate)}
- Monday of next week: ${addDays(startOfWeek(ctx.localDate), 7)}${
    ctx.preferredType ? `\n- The user CHOSE the type ${ctx.preferredType.toUpperCase()}: return every item as type "${ctx.preferredType}".` : ""
  }

## Rules
- Type, in this order: (1) the type the user chose (see Context); (2) explicit words: "tapşırıq"/"task" → task, "tədbir"/"event" → event; (3) a meeting, a call / zəng with someone, a plan with a person ("X ilə", "with X": dinner with family, Ramizlə görüş), or an appointment / fixed-time activity → event: qəbul, həkim, appointment, dərs, kurs, class, lesson, uçuş, flight, müsahibə, interview, vebinar, webinar, konsert, concert, təlim, training, toy, ad günü, party; (4) everything else → task. A clock time alone does NOT make an event: a task keeps its time in start_time (deadline/reminder; end_time and duration_minutes null). An event needs a clock time; if there is none, use task and flag "type". Vague part of day without a clock time ("sabah axşam", "tomorrow afternoon") → no start_time, part of day in notes. Event without end/duration → end_time and duration_minutes null.
- Several items ("…, bir də …", "sonra da", "həm də", "and also") → separate items; a shared date carries over. One item described twice is ONE item: "Axşama görüş olacaq, onu qeyd et: dostlarla görüş saat 20.30-da" = one event.
- Title: max ~6 words, spoken language, most specific wording ("Dostlarla görüş", not "Görüş"), imperative/noun form ("Power BI hesabatını bitir", "Call the bank"). Drop filler: "onu qeyd et", "qeyd et", "yadıma sal", "yadımda saxla", "xatırlat", "xatırlat ki", "olacaq", "lazımdır", "etməliyəm", "remind me to", "note that", "I need to", "don't forget to". Fix speech-to-text typos. Details go in notes.
- Dates: bu gün = today; sabah = tomorrow; birigün = +2 days; "axşama"/"bu axşam"/"axşam"/"tonight" without another day = TODAY evening; gələn həftə = Monday of next week; həftə sonu = Saturday; ayın sonu = last day of month; "3 gündən sonra" = +3 days. "çərşənbə axşamı" = Tuesday and "cümə axşamı" = Thursday (weekdays, NOT evenings). A bare weekday = its next occurrence (today if still ahead). "cümə gününə qədər"/"by Friday" = deadline that Friday. "next/gələn <weekday>" = that weekday in NEXT calendar week: on Monday 2026-11-09 "next Friday" = 2026-11-20, "this Friday"/"bu cümə" = 2026-11-13.
- Times: "20:30", "20.30", "20.30da", "20:30-da", "saat 20:30" → 20:30; "9:05" → 09:05; "saat 8-də", "8-də", "10-da", "7de" = that hour; "8 tamamda" = 8:00 sharp. "səhər 9" = 09:00, "günorta" = 12:00, "günortadan sonra 3" = 15:00, "axşam 7" = 19:00, "gecə 11" = 23:00. "3-ün yarısı" = 2:30, "4-ə 15 dəqiqə qalmış" = 3:45. Bare hour without part of day: 1–6 → PM, 7–11 → AM, 12 → 12:00; if the sentence mentions the evening, 1–11 → PM; when guessing, lower confidence and add "time" to uncertain_fields. No day given and that time today is already past Now: a bare morning hour becomes the evening if still ahead (at 17:20 "saat 7" = 19:00 today), otherwise use tomorrow; add "time" to uncertain_fields. English "3pm", "noon", "half past 4" as usual.
- Durations: "yarım saat" = 30, "1 saatlıq" = 60, "1.5 saat" = 90, "2 saatlıq" = 120 min.
- Priority high: "təcili(dir)", "vacib(dir)", "mütləq", "urgent", "ASAP", "important"; low: "tələsmədən", "nə vaxt olsa", "whenever", "low priority"; else medium.
- Category: ALWAYS exactly one of the user's category names, never null. In this order: (1) a custom category whose name clearly matches (EduPo → "EduPo", TLB → "TLB Academy"); (2) a meeting, or a call / zəng with a person → the Meeting category ("Görüş"/"Meeting"); (3) work-related (iş, ofis, hesabat, layihə, müştəri, təqdimat, müqavilə, report, project, presentation, client, deadline…) → Work ("İş"/"Work"); (4) everything else → Personal ("Şəxsi"/"Personal").
- detected_language: Azerbaijani with English words is still "az".
- confidence 0..1. If ambiguous: clarification (one short sentence, user's language) + uncertain_fields. Nothing actionable → items [] and top-level clarification.

## Examples (Now = 2026-11-09 10:00 Monday; categories "İş", "Görüş", "Şəxsi", "EduPo", "TLB Academy"; other fields as usual)
1. "Sabah saat 10-da Ramizlə EduPo demo görüşü" → event "EduPo demo — Ramiz", 2026-11-10 10:00, category EduPo
2. "Cümə gününə qədər Power BI hesabatını bitirməliyəm, təcilidir" → task "Power BI hesabatını bitir", 2026-11-13, no time, high, İş
3. "Remind me to call the bank tomorrow afternoon" → task "Call the bank", 2026-11-10, no time, notes "afternoon", Şəxsi
4. "Çərşənbə axşamı 3-də müştəri zəngi, yarım saatlıq, sonra da TLB üçün post yazmaq" → event "Müştəri zəngi" 2026-11-10 15:00–15:30 (30 min), Görüş + task "TLB postunu yaz" 2026-11-10, TLB Academy
5. "Next Friday 7pm dinner with family" → event "Family dinner", 2026-11-20 19:00, Şəxsi
6. "Axşama görüş olacaq onu qeyd et Dostlarla görüş saat 20.30da" → ONE event "Dostlarla görüş", 2026-11-09 20:30, Görüş
7. "Sabah saat 10-da Ramizlə EduPo demo görüşü, bir də cümə gününə qədər Power BI hesabatını bitir, təcilidir" → event "EduPo demo — Ramiz" 2026-11-10 10:00 EduPo + task "Power BI hesabatını bitir" 2026-11-13 high
8. "Ofisdə layihə təqdimatını hazırla" → task "Layihə təqdimatını hazırla", İş
9. "Anamla zəng saat 6-da" → event "Anamla zəng", 18:00, Görüş
10. "Dərman al" → task "Dərman al", Şəxsi
11. "Send the report to the client by Friday" → task "Send the report to the client", 2026-11-13, İş
12. "Saat 5-də dərman iç" → task "Dərman iç", 17:00 (task WITH a time), Şəxsi
13. "Sabah saat 10-da hesabatı göndər, tapşırıq kimi" → task "Hesabatı göndər", 2026-11-10 10:00, İş
14. "Cümə günü saat 3-də tədbir: komanda yığıncağı" → event "Komanda yığıncağı", 2026-11-13 15:00, Görüş
15. "Sabah saat 11-də həkim qəbulu" → event "Həkim qəbulu", 2026-11-10 11:00, Şəxsi
16. "Friday 6pm flight to Istanbul" → event "Flight to Istanbul", 2026-11-13 18:00, Şəxsi
(Use the real category names, e.g. "Personal" when categories are in English.)`;
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
