/**
 * Every item gets a category, never empty (İsrafil, 2026-11-10):
 * 1. one of the user's own categories when its name clearly appears ("EduPo", "TLB")
 * 2. a meeting, or a call / zəng with someone → Meeting
 * 3. work-related → Work
 * 4. everything else → Personal
 * Used by the on-device draft and as the fallback when the AI leaves the category empty.
 */
const MEETING_NAMES = ["görüş", "meeting"];
const WORK_NAMES = ["iş", "work"];
const PERSONAL_NAMES = ["şəxsi", "personal"];
const GENERIC = new Set([...MEETING_NAMES, ...WORK_NAMES, ...PERSONAL_NAMES]);

// \b doesn't work next to Azerbaijani letters, so words are delimited with Unicode lookarounds
const word = (body: string) => new RegExp(`(?<![\\p{L}\\p{N}])(?:${body})(?![\\p{L}\\p{N}])`, "iu");

const MEETING = word(
  "görüş\\p{L}*|toplantı\\p{L}*|iclas\\p{L}*|müsahibə\\p{L}*|zəng\\p{L}*|meeting|meet(?:ing)? with|call(?:s|ed)?|interview|appointment|sync|1:1",
);
const WORK = word(
  "iş|işə|işdə|işdən|işi|ofis\\p{L}*|hesabat\\p{L}*|layihə\\p{L}*|müştəri\\p{L}*|təqdimat\\p{L}*|müqavilə\\p{L}*|faktura\\p{L}*|tapşırıq verən|deadline\\p{L}*|work|office|report\\p{L}*|project\\p{L}*|presentation\\p{L}*|client\\p{L}*|customer\\p{L}*|invoice\\p{L}*|contract\\p{L}*|proposal\\p{L}*|email|e-?poçt\\p{L}*",
);

const norm = (s: string) => s.trim().toLocaleLowerCase("az").normalize("NFC");
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export type CategoryBucket = "meeting" | "work" | "personal";

export function bucketFor(text: string): CategoryBucket {
  if (MEETING.test(text)) return "meeting";
  if (WORK.test(text)) return "work";
  return "personal";
}

/** A custom category whose name (or its first word, e.g. "TLB" of "TLB Academy") appears in the text. */
function customMatch(text: string, names: string[]): string | null {
  for (const name of names) {
    const n = norm(name);
    if (GENERIC.has(n)) continue;
    const first = n.split(/\s+/)[0];
    const keys = first.length >= 3 && first !== n ? [n, first] : [n];
    if (keys.some((k) => word(escape(k)).test(text))) return name;
  }
  return null;
}

/**
 * Picks a category NAME from `names` (both languages may be listed) for this text.
 * Returns null only when the user has no categories at all.
 */
export function categoryNameFor(text: string, names: string[]): string | null {
  if (names.length === 0) return null;
  const custom = customMatch(text, names);
  if (custom) return custom;
  const want = { meeting: MEETING_NAMES, work: WORK_NAMES, personal: PERSONAL_NAMES }[bucketFor(text)];
  return (
    names.find((n) => want.includes(norm(n))) ??
    names.find((n) => PERSONAL_NAMES.includes(norm(n))) ?? // the generic one was deleted → Personal
    names.find((n) => !GENERIC.has(norm(n))) ?? // only custom ones left → the first of them
    names[0]
  );
}
