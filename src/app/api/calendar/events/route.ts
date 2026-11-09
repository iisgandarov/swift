import { z } from "zod";
import { withAuth, json } from "@/lib/server/api";
import { localDate } from "@/lib/domain/schemas";
import { addDays, DEFAULT_TZ, localToUtcIso } from "@/lib/dates";
import { getCalendarClient, ReconnectRequired } from "@/lib/google/client";
import type { GoogleEventLite } from "@/lib/google/event-mapping";

const querySchema = z
  .object({ from: localDate, to: localDate })
  .refine((q) => q.from <= q.to && q.to <= addDays(q.from, 62), "range too large");

// tiny per-user cache so swiping between days doesn't hit Google every time
const cache = new Map<string, { at: number; events: GoogleEventLite[] }>();
const TTL_MS = 60_000;

/**
 * Read-only events from the user's Google Calendar for a local date range.
 * Events that Swift itself created are left out (they are already shown as Swift items).
 */
export const GET = withAuth(async (ctx, req) => {
  const { from, to } = querySchema.parse(Object.fromEntries(req.nextUrl.searchParams));
  let cal;
  try {
    cal = await getCalendarClient(ctx);
  } catch (err) {
    if (err instanceof ReconnectRequired) return json({ events: [], status: "reconnect_required" });
    throw err;
  }
  if (!cal) return json({ events: [], status: "not_connected" });

  const key = `${ctx.user.id}:${from}:${to}`;
  const hit = cache.get(key);
  let events = hit && Date.now() - hit.at < TTL_MS ? hit.events : null;
  if (!events) {
    const tz = (await ctx.repo.getProfile())?.timezone ?? DEFAULT_TZ;
    try {
      events = await cal.listEvents(localToUtcIso(from, "00:00", tz), localToUtcIso(addDays(to, 1), "00:00", tz));
    } catch (err) {
      if (err instanceof ReconnectRequired) return json({ events: [], status: "reconnect_required" });
      console.error("[calendar events]", err);
      return json({ events: [], status: "error" });
    }
    cache.set(key, { at: Date.now(), events });
    if (cache.size > 200) cache.delete(cache.keys().next().value!);
  }

  const items = await ctx.repo.listItems({ from: addDays(from, -1), to: addDays(to, 1) });
  const own = new Set(items.map((i) => i.google_event_id).filter(Boolean));
  return json({ events: events.filter((e) => !own.has(e.id)), status: "ok" });
});
