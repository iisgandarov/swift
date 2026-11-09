import "server-only";
import type { CalendarClient } from "./client";
import { localToUtcIso, todayLocal, addDays } from "@/lib/dates";
import type { GoogleEventLite } from "./event-mapping";

/** In-memory "Google Calendar" for demo mode, with a few pre-existing events to show in the Calendar view. */
const g = globalThis as unknown as { __swiftDemoGoogle?: Map<string, GoogleEventLite> };

function store() {
  if (!g.__swiftDemoGoogle) {
    const today = todayLocal();
    const ev = (id: string, title: string, date: string, s: string, e: string): GoogleEventLite => ({
      id, title, date, start_at: localToUtcIso(date, s), end_at: localToUtcIso(date, e), all_day: false, html_link: null, color: null,
    });
    g.__swiftDemoGoogle = new Map(
      [
        ev("g-1", "Dizayn icmalı", today, "09:30", "10:00"),
        ev("g-2", "Layihə müzakirəsi", today, "14:00", "15:00"),
        ev("g-3", "Strategiya sessiyası", addDays(today, 2), "16:00", "17:00"),
      ].map((e) => [e.id, e]),
    );
  }
  return g.__swiftDemoGoogle;
}

export function demoCalendar(_calendarId: string): CalendarClient {
  return {
    async createEvent(item) {
      if (/fail-sync/i.test(item.title)) throw new Error("google_500: simulated failure");
      const id = `swift-${item.id}`;
      store().set(id, { id, title: item.title, date: item.date!, start_at: item.start_at, end_at: item.end_at, all_day: item.all_day, html_link: null, color: null });
      return id;
    },
    async updateEvent(googleId, item) {
      if (!store().has(googleId)) return "gone";
      store().set(googleId, { id: googleId, title: item.title, date: item.date!, start_at: item.start_at, end_at: item.end_at, all_day: item.all_day, html_link: null, color: null });
      return "ok";
    },
    async deleteEvent(googleId) {
      store().delete(googleId);
    },
    async listEvents(fromIso, toIso) {
      return [...store().values()].filter((e) => {
        const s = e.start_at ?? `${e.date}T00:00:00.000Z`;
        return s >= fromIso && s < toIso;
      });
    },
    async listCalendars() {
      return [
        { id: "primary", summary: "İsrafil", primary: true },
        { id: "work@group.calendar.google.com", summary: "Work", primary: false },
      ];
    },
  };
}
