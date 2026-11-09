import { z } from "zod";
import { withAuth, json } from "@/lib/server/api";
import { retrySync } from "@/lib/server/items";

export const POST = withAuth<{ id: string }>(async (ctx, _req, params) => {
  return json({ item: await retrySync(ctx, z.uuid().parse(params.id)) });
});
