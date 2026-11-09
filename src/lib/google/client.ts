import "server-only";
import type { Item } from "@/lib/domain/types";
import type { AppContext } from "@/lib/server/context";
import { googleConfigured } from "@/lib/server/env";
import { DEFAULT_TZ } from "@/lib/dates";
import { decryptToken } from "./crypto";
import { GoogleAuthError, refreshAccessToken } from "./oauth";
import { fromGoogleEvent, toGoogleEvent, type GoogleEventLite } from "./event-mapping";
import { demoCalendar } from "./demo-calendar";

export interface CalendarClient {
  createEvent(item: Item): Promise<string>;
  /** Returns "gone" when the event no longer exists in Google (404/410). */
  updateEvent(googleId: string, item: Item): Promise<"ok" | "gone">;
  deleteEvent(googleId: string): Promise<void>;
  listEvents(fromIso: string, toIso: string): Promise<GoogleEventLite[]>;
  listCalendars(): Promise<{ id: string; summary: string; primary: boolean }[]>;
}

export class ReconnectRequired extends Error {
  constructor() {
    super("google_reconnect_required");
  }
}

const API = "https://www.googleapis.com/calendar/v3";

// short-lived access tokens, per user, kept in memory (refresh tokens stay encrypted in the DB)
const tokenCache = new Map<string, { token: string; exp: number }>();

async function accessToken(ctx: AppContext, refreshSealed: string): Promise<string> {
  const cached = tokenCache.get(ctx.user.id);
  if (cached && cached.exp > Date.now() + 60_000) return cached.token;
  try {
    const t = await refreshAccessToken(decryptToken(refreshSealed));
    tokenCache.set(ctx.user.id, { token: t.access_token, exp: Date.now() + t.expires_in * 1000 });
    return t.access_token;
  } catch (err) {
    if (err instanceof GoogleAuthError && (err.code === "invalid_grant" || err.code === "unauthorized_client")) {
      // revoked, expired (7-day "Testing" limit) or password changed: ask the user to reconnect
      await ctx.repo.updateGoogleConnection({ needs_reconnect: true, last_error: err.code });
      throw new ReconnectRequired();
    }
    throw err;
  }
}

export function forgetAccessToken(userId: string) {
  tokenCache.delete(userId);
}

/** Returns a calendar client for the user, or null when Google Calendar isn't connected. */
export async function getCalendarClient(ctx: AppContext): Promise<CalendarClient | null> {
  if (ctx.demo) {
    const conn = await ctx.repo.getGoogleConnection();
    return conn ? demoCalendar(conn.calendar_id) : null;
  }
  if (!googleConfigured()) return null;
  const conn = await ctx.repo.getGoogleConnection();
  if (!conn) return null;
  if (conn.needs_reconnect) throw new ReconnectRequired();
  const tz = (await ctx.repo.getProfile())?.timezone ?? DEFAULT_TZ;
  const cal = encodeURIComponent(conn.calendar_id);

  async function call(path: string, init: RequestInit = {}, retry = true): Promise<Response> {
    const token = await accessToken(ctx, conn!.refresh_token_encrypted);
    const res = await fetch(`${API}${path}`, {
      ...init,
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json", ...init.headers },
      signal: AbortSignal.timeout(15_000),
    });
    if (res.status === 401 && retry) {
      forgetAccessToken(ctx.user.id);
      return call(path, init, false);
    }
    return res;
  }

  async function fail(res: Response): Promise<never> {
    const text = await res.text().catch(() => "");
    throw new Error(`google_${res.status}: ${text.slice(0, 200)}`);
  }

  return {
    async createEvent(item) {
      const res = await call(`/calendars/${cal}/events`, { method: "POST", body: JSON.stringify(toGoogleEvent(item, tz)) });
      if (!res.ok) return fail(res);
      return ((await res.json()) as { id: string }).id;
    },
    async updateEvent(googleId, item) {
      const res = await call(`/calendars/${cal}/events/${encodeURIComponent(googleId)}`, {
        method: "PATCH",
        body: JSON.stringify(toGoogleEvent(item, tz)),
      });
      if (res.status === 404 || res.status === 410) return "gone";
      if (!res.ok) return fail(res);
      return "ok";
    },
    async deleteEvent(googleId) {
      const res = await call(`/calendars/${cal}/events/${encodeURIComponent(googleId)}`, { method: "DELETE" });
      if (res.ok || res.status === 404 || res.status === 410) return;
      return fail(res);
    },
    async listEvents(fromIso, toIso) {
      const out: GoogleEventLite[] = [];
      let pageToken: string | undefined;
      do {
        const q = new URLSearchParams({
          timeMin: fromIso,
          timeMax: toIso,
          singleEvents: "true",
          orderBy: "startTime",
          maxResults: "250",
          ...(pageToken ? { pageToken } : {}),
        });
        const res = await call(`/calendars/${cal}/events?${q}`);
        if (!res.ok) return fail(res);
        const body = (await res.json()) as { items?: Parameters<typeof fromGoogleEvent>[0][]; nextPageToken?: string };
        for (const e of body.items ?? []) {
          const lite = fromGoogleEvent(e, tz);
          if (lite) out.push(lite);
        }
        pageToken = body.nextPageToken;
      } while (pageToken && out.length < 1000);
      return out;
    },
    async listCalendars() {
      const res = await call(`/users/me/calendarList?minAccessRole=writer`);
      if (!res.ok) return fail(res);
      const body = (await res.json()) as { items?: { id: string; summary: string; primary?: boolean; summaryOverride?: string }[] };
      return (body.items ?? []).map((c) => ({ id: c.id, summary: c.summaryOverride ?? c.summary, primary: Boolean(c.primary) }));
    },
  };
}
