import { z } from "zod";
import { withAuth, json, readJson } from "@/lib/server/api";
import { focusSessionInputSchema } from "@/lib/domain/schemas";

export const GET = withAuth(async (ctx, req) => {
  const since = z.iso.datetime().parse(req.nextUrl.searchParams.get("since") ?? new Date(Date.now() - 35 * 86_400_000).toISOString());
  return json({ sessions: await ctx.repo.listFocusSessions(since) });
});

export const POST = withAuth(async (ctx, req) => {
  const input = focusSessionInputSchema.parse(await readJson(req));
  if (input.item_id && !(await ctx.repo.getItem(input.item_id))) input.item_id = null;
  return json({ session: await ctx.repo.createFocusSession(input) }, 201);
});
