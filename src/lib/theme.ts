export const THEME_COOKIE = "swift_theme";
export const themes = ["system", "light", "dark"] as const;
export type ThemePref = (typeof themes)[number];

export function isThemePref(v: unknown): v is ThemePref {
  return typeof v === "string" && (themes as readonly string[]).includes(v);
}

export const THEME_COLORS = { light: "#F5F8FF", dark: "#000000" } as const;
