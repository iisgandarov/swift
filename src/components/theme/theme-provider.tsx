"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { setClientCookie } from "@/lib/cookies";
import { THEME_COLORS, THEME_COOKIE, type ThemePref } from "@/lib/theme";

type ThemeContextValue = {
  theme: ThemePref;
  resolved: "light" | "dark";
  setTheme: (t: ThemePref) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);
const DARK_MQ = "(prefers-color-scheme: dark)";

function subscribeSystem(cb: () => void) {
  const mq = window.matchMedia(DARK_MQ);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

function apply(dark: boolean, theme: ThemePref) {
  const root = document.documentElement;
  root.classList.toggle("dark", dark);
  root.dataset.theme = theme;
  // keep the browser/status-bar colour in sync with the chosen theme
  document
    .querySelectorAll('meta[name="theme-color"]')
    .forEach((m) => m.setAttribute("content", dark ? THEME_COLORS.dark : THEME_COLORS.light));
}

export function ThemeProvider({ initialTheme, children }: { initialTheme: ThemePref; children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemePref>(initialTheme);
  const systemDark = useSyncExternalStore(
    subscribeSystem,
    () => window.matchMedia(DARK_MQ).matches,
    () => false,
  );
  const resolved: "light" | "dark" = theme === "system" ? (systemDark ? "dark" : "light") : theme;

  // Sync DOM whenever the resolved theme changes (incl. OS switching while on "system").
  useEffect(() => apply(resolved === "dark", theme), [resolved, theme]);

  const setTheme = useCallback((t: ThemePref) => {
    setClientCookie(THEME_COOKIE, t);
    setThemeState(t);
  }, []);

  const value = useMemo(() => ({ theme, resolved, setTheme }), [theme, resolved, setTheme]);
  return <ThemeContext value={value}>{children}</ThemeContext>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
  return ctx;
}
