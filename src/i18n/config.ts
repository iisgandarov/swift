export const locales = ["az", "en"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "az";
export const LOCALE_COOKIE = "swift_locale";

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (locales as readonly string[]).includes(value);
}

/** Picks az/en from an Accept-Language header; Azerbaijani wins only if preferred over English. */
export function localeFromAcceptLanguage(header: string | null | undefined): Locale {
  if (!header) return defaultLocale;
  const ranked = header
    .split(",")
    .map((part) => {
      const [tag, q] = part.trim().split(";q=");
      return { lang: tag.toLowerCase().split("-")[0], q: q ? Number(q) : 1 };
    })
    .sort((a, b) => b.q - a.q);
  for (const { lang } of ranked) {
    if (isLocale(lang)) return lang;
  }
  return "en";
}
