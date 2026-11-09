import "server-only";
import { DEFAULT_TZ, zonedParts } from "@/lib/dates";
import type { AppContext } from "@/lib/server/context";
import type { ParseContext } from "./schema";

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export async function buildParseContext(ctx: AppContext): Promise<ParseContext> {
  const [profile, categories] = await Promise.all([ctx.repo.getProfile(), ctx.repo.listCategories()]);
  const tz = profile?.timezone ?? DEFAULT_TZ;
  const now = new Date();
  const p = zonedParts(tz, now);
  const uiLocale = profile?.ui_locale ?? "az";
  return {
    now: now.toISOString(),
    timezone: tz,
    localDate: p.date,
    localTime: p.time,
    weekday: WEEKDAYS[p.weekday],
    uiLocale,
    // both names so the model can match whichever language was spoken
    categories: categories.flatMap((c) => (c.name_az === c.name_en ? [c.name_en] : [c.name_az, c.name_en])),
    defaultEventMinutes: profile?.default_event_minutes ?? 60,
  };
}
