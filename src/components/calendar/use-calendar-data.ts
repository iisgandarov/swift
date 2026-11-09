"use client";

import { useMemo } from "react";
import type { Item } from "@/lib/domain/types";
import { categoryStyle, itemTimes } from "@/lib/client/display";
import { useBootstrap, useCategories, useGoogleEvents, useRangeItems, type GoogleEventLite } from "@/lib/client/queries";
import { utcToLocal } from "@/lib/dates";

export type AgendaEntry =
  | { kind: "item"; key: string; item: Item; start: string | null; end: string | null; color: string }
  | { kind: "google"; key: string; event: GoogleEventLite; start: string | null; end: string | null; color: string };

const GOOGLE_COLOR = "var(--cat-blue)";
const NO_CAT_COLOR = "var(--cat-slate)";

/** Swift items + Google events for a date range, grouped per day, with colored dots for the strip/grid. */
export function useCalendarData(from: string, to: string, tz: string) {
  const categories = useCategories();
  const google = useBootstrap().data?.google;
  const connected = Boolean(google?.connected && !google.needs_reconnect);
  const items = useRangeItems(from, to);
  const gEvents = useGoogleEvents(from, to, connected);

  return useMemo(() => {
    const color = (i: Item) => {
      const c = categories.find((x) => x.id === i.category_id);
      return c ? categoryStyle(c.color).dot : NO_CAT_COLOR;
    };
    const byDay: Record<string, AgendaEntry[]> = {};
    const push = (d: string, e: AgendaEntry) => (byDay[d] ??= []).push(e);

    for (const i of items.data ?? []) {
      if (!i.date) continue;
      const tm = itemTimes(i, tz);
      push(i.date, { kind: "item", key: i.id, item: i, start: tm?.start ?? null, end: tm?.end ?? null, color: color(i) });
    }
    for (const e of gEvents.data?.events ?? []) {
      push(e.date, {
        kind: "google",
        key: `g-${e.id}`,
        event: e,
        start: e.start_at ? utcToLocal(e.start_at, tz).time : null,
        end: e.end_at ? utcToLocal(e.end_at, tz).time : null,
        color: GOOGLE_COLOR,
      });
    }
    for (const list of Object.values(byDay)) {
      list.sort((a, b) => (a.start ?? "99") .localeCompare(b.start ?? "99"));
    }
    const dots: Record<string, string[]> = {};
    for (const [d, list] of Object.entries(byDay)) dots[d] = [...new Set(list.map((e) => e.color))];
    return { byDay, dots, loading: items.isPending, googleStatus: gEvents.data?.status ?? (connected ? "loading" : "not_connected") };
  }, [items.data, items.isPending, gEvents.data, categories, tz, connected]);
}
