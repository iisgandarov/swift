import { withAuth, json, HttpError } from "@/lib/server/api";
import { getCalendarClient, ReconnectRequired } from "@/lib/google/client";

export const GET = withAuth(async (ctx) => {
  try {
    const cal = await getCalendarClient(ctx);
    if (!cal) throw new HttpError(409, "not_connected");
    return json({ calendars: await cal.listCalendars() });
  } catch (err) {
    if (err instanceof ReconnectRequired) throw new HttpError(409, "reconnect_required");
    throw err;
  }
});
