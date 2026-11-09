import { z } from "zod";
import { withAuth, json, readJson, HttpError } from "@/lib/server/api";
import { getGoogleStatus } from "@/lib/google/status";

export const GET = withAuth(async (ctx) => json({ google: await getGoogleStatus(ctx) }));

export const PATCH = withAuth(async (ctx, req) => {
  const { calendar_id } = z.object({ calendar_id: z.string().min(1).max(300) }).parse(await readJson(req));
  if (!(await ctx.repo.getGoogleConnection())) throw new HttpError(409, "not_connected");
  await ctx.repo.updateGoogleConnection({ calendar_id });
  return json({ google: await getGoogleStatus(ctx) });
});
