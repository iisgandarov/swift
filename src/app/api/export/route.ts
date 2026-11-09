import { withAuth } from "@/lib/server/api";
import { NextResponse } from "next/server";

/** Everything Swift stores about the user, as a JSON download (no tokens). */
export const GET = withAuth(async (ctx) => {
  const [profile, categories, items, focus_sessions, google] = await Promise.all([
    ctx.repo.getProfile(),
    ctx.repo.listCategories(),
    ctx.repo.listItems({ all: true }),
    ctx.repo.listFocusSessions("1970-01-01T00:00:00.000Z"),
    ctx.repo.getGoogleConnection(),
  ]);
  const body = {
    exported_at: new Date().toISOString(),
    app: "Swift",
    user: { email: ctx.user.email },
    profile,
    categories,
    items,
    focus_sessions,
    google_calendar: google ? { email: google.google_email, calendar_id: google.calendar_id, connected_at: google.connected_at } : null,
  };
  return new NextResponse(JSON.stringify(body, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="swift-export-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  });
});
