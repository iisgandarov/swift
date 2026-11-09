/**
 * Date helpers. All "local" values are wall-clock values in the user's timezone
 * (default Asia/Baku), represented as plain strings so they never drift with the
 * machine timezone: dates as "YYYY-MM-DD", times as "HH:mm".
 * Weeks start on Monday.
 */
import { TZDate } from "@date-fns/tz";
import type { LocalDate, LocalTime } from "@/lib/domain/types";

export const DEFAULT_TZ = "Asia/Baku";

const pad = (n: number) => String(n).padStart(2, "0");

/** Parts of "now" (or a given instant) in the timezone. */
export function zonedParts(tz: string = DEFAULT_TZ, at: Date | number = Date.now()) {
  const d = new TZDate(typeof at === "number" ? at : at.getTime(), tz);
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` as LocalDate,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}` as LocalTime,
    hour: d.getHours(),
    weekday: mondayIndexFromJs(d.getDay()),
  };
}

export function todayLocal(tz: string = DEFAULT_TZ, at?: Date | number): LocalDate {
  return zonedParts(tz, at).date;
}

/** Converts a local date + time in `tz` to a UTC ISO string. */
export function localToUtcIso(date: LocalDate, time: LocalTime, tz: string = DEFAULT_TZ): string {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  return new Date(new TZDate(y, m - 1, d, hh, mm, 0, tz).getTime()).toISOString();
}

/** Local date + time of a UTC instant, as seen in `tz`. */
export function utcToLocal(iso: string, tz: string = DEFAULT_TZ): { date: LocalDate; time: LocalTime } {
  const p = zonedParts(tz, new Date(iso));
  return { date: p.date, time: p.time };
}

function toUtcDay(date: LocalDate) {
  const [y, m, d] = date.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}
function fromUtcDay(ms: number): LocalDate {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export function addDays(date: LocalDate, days: number): LocalDate {
  return fromUtcDay(toUtcDay(date) + days * 86_400_000);
}

export function diffDays(a: LocalDate, b: LocalDate): number {
  return Math.round((toUtcDay(a) - toUtcDay(b)) / 86_400_000);
}

/** 0 = Monday … 6 = Sunday */
export function mondayIndexFromJs(jsDay: number) {
  return (jsDay + 6) % 7;
}

export function weekdayIndex(date: LocalDate): number {
  return mondayIndexFromJs(new Date(toUtcDay(date)).getUTCDay());
}

export function startOfWeek(date: LocalDate): LocalDate {
  return addDays(date, -weekdayIndex(date));
}

export function weekDays(date: LocalDate): LocalDate[] {
  const start = startOfWeek(date);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function startOfMonth(date: LocalDate): LocalDate {
  return `${date.slice(0, 7)}-01`;
}

export function daysInMonth(date: LocalDate): number {
  const [y, m] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function addMonths(date: LocalDate, n: number): LocalDate {
  const [y, m] = date.split("-").map(Number);
  const total = y * 12 + (m - 1) + n;
  return `${Math.floor(total / 12)}-${pad((total % 12) + 1)}-01`;
}

/** Monday-start grid of 6 weeks (42 days) covering the month of `date`. */
export function monthGrid(date: LocalDate): LocalDate[] {
  const first = startOfWeek(startOfMonth(date));
  return Array.from({ length: 42 }, (_, i) => addDays(first, i));
}

export function addMinutesToTime(time: LocalTime, minutes: number): { time: LocalTime; dayOffset: number } {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + minutes;
  const dayOffset = Math.floor(total / 1440);
  const t = ((total % 1440) + 1440) % 1440;
  return { time: `${pad(Math.floor(t / 60))}:${pad(t % 60)}`, dayOffset };
}

export function timeToMinutes(time: LocalTime): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export function minutesBetween(startIso: string, endIso: string): number {
  return Math.round((new Date(endIso).getTime() - new Date(startIso).getTime()) / 60000);
}

// ---------------------------------------------------------------- labels

export const AZ_WEEKDAYS_SHORT = ["B.E.", "Ç.A.", "Ç.", "C.A.", "C.", "Ş.", "B."] as const;
export const EN_WEEKDAYS_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
export const AZ_MONTHS = [
  "Yanvar", "Fevral", "Mart", "Aprel", "May", "İyun",
  "İyul", "Avqust", "Sentyabr", "Oktyabr", "Noyabr", "Dekabr",
] as const;
export const AZ_MONTHS_SHORT = ["Yan", "Fev", "Mar", "Apr", "May", "İyn", "İyl", "Avq", "Sen", "Okt", "Noy", "Dek"] as const;
export const EN_MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;
export const EN_MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

export type UiLocale = "az" | "en";

function parts(date: LocalDate) {
  const [y, m, d] = date.split("-").map(Number);
  return { y, m, d };
}

export function weekdayShort(date: LocalDate, locale: UiLocale) {
  const i = weekdayIndex(date);
  return locale === "az" ? AZ_WEEKDAYS_SHORT[i] : EN_WEEKDAYS_SHORT[i];
}

/** "9 Noy, B.E." (az) / "Mon, Nov 9" (en) */
export function formatDayLabel(date: LocalDate, locale: UiLocale) {
  const { m, d } = parts(date);
  return locale === "az"
    ? `${d} ${AZ_MONTHS_SHORT[m - 1]}, ${weekdayShort(date, "az")}`
    : `${weekdayShort(date, "en")}, ${EN_MONTHS_SHORT[m - 1]} ${d}`;
}

/** "9 Noy" (az) / "Nov 9" (en), adds the year if it differs from `refYear`. */
export function formatShortDate(date: LocalDate, locale: UiLocale, refYear?: number) {
  const { y, m, d } = parts(date);
  const year = refYear !== undefined && refYear !== y ? ` ${y}` : "";
  return locale === "az" ? `${d} ${AZ_MONTHS_SHORT[m - 1]}${year}` : `${EN_MONTHS_SHORT[m - 1]} ${d}${year ? `,${year}` : ""}`;
}

/** "Noyabr 2026" / "November 2026" */
export function formatMonthYear(date: LocalDate, locale: UiLocale) {
  const { y, m } = parts(date);
  return `${(locale === "az" ? AZ_MONTHS : EN_MONTHS)[m - 1]} ${y}`;
}

/** "9 Noyabr 2026" / "November 9, 2026" */
export function formatLongDate(date: LocalDate, locale: UiLocale) {
  const { y, m, d } = parts(date);
  return locale === "az" ? `${d} ${AZ_MONTHS[m - 1]} ${y}` : `${EN_MONTHS[m - 1]} ${d}, ${y}`;
}

/** Azerbaijani always uses 24h; English follows the user's setting. */
export function formatTime(time: LocalTime, locale: UiLocale, format: "24h" | "12h" = "24h") {
  if (locale === "az" || format === "24h") return time;
  const [h, m] = time.split(":").map(Number);
  const suffix = h < 12 ? "AM" : "PM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${pad(m)} ${suffix}`;
}

export function formatTimeRange(start: LocalTime, end: LocalTime | null, locale: UiLocale, format: "24h" | "12h" = "24h") {
  const s = formatTime(start, locale, format);
  return end ? `${s} – ${formatTime(end, locale, format)}` : s;
}

export type GreetingKey = "morning" | "afternoon" | "evening";
/** 05–12 morning, 12–18 afternoon, 18–05 evening */
export function greetingKey(hour: number): GreetingKey {
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 18) return "afternoon";
  return "evening";
}
