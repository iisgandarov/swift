"use client";

/**
 * Client-side navigation for the app shell. Uses the native History API, which
 * Next.js syncs into usePathname/useSearchParams — so switching screens never
 * makes a server request (no RSC fetch, no proxy/auth round-trip).
 */
let depth = 0; // in-app history entries we pushed, so Back can stay inside the app

export function navigate(path: string, opts: { replace?: boolean } = {}) {
  if (typeof window === "undefined") return;
  const current = window.location.pathname + window.location.search;
  if (current === path) return;
  if (opts.replace) {
    window.history.replaceState(null, "", path);
  } else {
    window.history.pushState(null, "", path);
    depth++;
  }
  window.scrollTo({ top: 0 });
}

/** Back inside the app when possible, otherwise to a fallback screen (e.g. after a cold start on /new). */
export function goBack(fallback = "/") {
  if (depth > 0) {
    depth--;
    window.history.back();
  } else {
    navigate(fallback, { replace: true });
  }
}

/** Path → which screen of the shell it shows. */
export type Screen =
  | { kind: "tab"; tab: TabKey }
  | { kind: "new"; mode: "choice" | "text" | "voice" }
  | { kind: "edit"; id: string; makeEvent: boolean };

export const TABS = ["home", "calendar", "focus", "stats", "settings"] as const;
export type TabKey = (typeof TABS)[number];
export const TAB_PATH: Record<TabKey, string> = {
  home: "/",
  calendar: "/calendar",
  focus: "/focus",
  stats: "/stats",
  settings: "/settings",
};

export function screenFor(pathname: string, search: URLSearchParams): Screen {
  if (pathname.startsWith("/edit/")) {
    return { kind: "edit", id: decodeURIComponent(pathname.slice(6)), makeEvent: search.get("type") === "event" };
  }
  if (pathname === "/new/voice" || (pathname === "/new" && search.get("voice") === "1")) return { kind: "new", mode: "voice" };
  if (pathname === "/new/text" || pathname === "/new") return { kind: "new", mode: "text" };
  const tab = (Object.entries(TAB_PATH).find(([, p]) => p === pathname)?.[0] ?? "home") as TabKey;
  return { kind: "tab", tab };
}
