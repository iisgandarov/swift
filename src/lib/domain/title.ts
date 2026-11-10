/**
 * Title cleaning shared by the on-device draft and the AI answer: a title says WHAT to do;
 * filler ("qeyd et", "yadda saxla", "remind me to"), clock times and date words belong elsewhere.
 * Unicode word boundaries throughout: \\b fails next to ə, ü, ş, ı.
 */
export const word = (alts: string) => new RegExp(`(?<![\\p{L}\\p{N}])(?:${alts})(?![\\p{L}\\p{N}])`, "giu");
export const FILLER = [
  word("onu qeyd et|qeyd et|qeyd elə|yadda saxla|yadımda saxla|yadıma sal|xatırlat ki|xatırlat|olacaq|lazımdır|etməliyəm|üçün|remind me to|remind me|note that|i need to|don't forget to|please"),
  /,?\s*(təcilidir|təcili|vacibdir|vacib|mütləq|urgent|asap|it's urgent|important)/giu,
];
/** Date and time words: the draft keeps the date/time in its own fields. */
export const WHEN = [
  word("bu gün|bugün|sabah|birigün|bu axşam|axşama|gələn həftə|bu həftə|həftə sonu|ayın sonu|\\d+ gündən sonra|gününə qədər|qədər|today|tomorrow|tonight|day after tomorrow|next week|this week|in \\d+ days|gələn|next|this|by|on|at"),
  word("günortadan sonra|səhərə|səhər|axşam|gecə|günorta|morning|afternoon|evening|noon"),
  word("yarım saatlıq|yarım saat|bir saatlıq|1 saatlıq|\\d+ saatlıq|half an hour|one hour|\\d+ minutes?|\\d+ dəqiqə(?:lik)?"),
];

const MARKERS = /(?<!\p{L})(tapşırıq|tədbir|task|event)( kimi| olaraq)?:?(?!\p{L})/gu;
const CLOCK = /(saat\s*)?\d{1,2}([:.]\d{2})?\s*(am|pm|-?(da|də|de|ə|e|a|ün|un|dan|dən))?(?=[\s,.:;]|$)/gu;
/** In an AI title only explicit clock times go: "saat 10", "10:30", "10-da", "5pm" — not "3 chapters". */
const SFX = "(?:-?(?:da|də|de|dan|dən|a|ə|e|ün|un))?";
const CLOCK_AI = new RegExp(
  `(?<![\\p{L}\\p{N}])(?:saat\\s*\\d{1,2}(?:[:.]\\d{2})?${SFX}|\\d{1,2}[:.]\\d{2}${SFX}|\\d{1,2}\\s*(?:am|pm)|\\d{1,2}-(?:da|də|de|dan|dən))(?![\\p{L}\\p{N}])`,
  "giu",
);
const tidy = (t: string) =>
  t
    .replace(/(?<![\p{L}\p{N}])saat(?![\p{L}\p{N}])/gu, " ")
    .replace(/\s+/g, " ")
    .replace(/^[\s,.:;!?"“”'«»-]+|[\s,.:;!?"“”'«»-]+$/g, "")
    .replace(/\s+[,.:;]/g, (m) => m.trim());

/**
 * "draft": the on-device parser's lowercased sentence → every date/time word removed.
 * "ai": a title the AI wrote → filler, clock times, and date words only at the start or end
 * (so "Work on report" keeps its words). Never returns an empty string if the input had words.
 */
export function cleanTitle(input: string, mode: "draft" | "ai"): string {
  let t = input.replace(MARKERS, " ").replace(/(\p{L}+?)(məliyəm|malıyam)(?!\p{L})/gu, "$1");
  for (const re of FILLER) t = t.replace(re, " ");
  t = t.replace(mode === "draft" ? CLOCK : CLOCK_AI, " ");
  if (mode === "draft") {
    for (const re of WHEN) t = t.replace(re, " ");
  } else {
    // only at the edges: "Sabah görüş", "Görüş sabah" → "Görüş"
    for (let i = 0; i < 3; i++) {
      for (const re of WHEN) {
        const src = re.source;
        t = t.replace(new RegExp(`^\\s*(?:${src})`, "iu"), " ").replace(new RegExp(`(?:${src})\\s*[,.]?\\s*$`, "iu"), " ");
      }
    }
  }
  const out = tidy(t);
  if (!out) return tidy(input) || input.trim();
  if (mode === "draft" || out[0] === input.trim()[0]) return out;
  // the start changed ("Sabah görüş" → "görüş"): capitalise, the Azerbaijani way only for Azerbaijani text
  return (/[əğıöüşçİ]/i.test(out) ? out[0].toLocaleUpperCase("az") : out[0].toUpperCase()) + out.slice(1);
}
