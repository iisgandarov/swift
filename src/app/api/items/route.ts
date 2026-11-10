import { z } from "zod";
import { withAuth, json, readJson } from "@/lib/server/api";
import { itemInputSchema, localDate } from "@/lib/domain/schemas";
import { createItems } from "@/lib/server/items";
import { timingFor } from "@/lib/server/timing";

const querySchema = z.object({ from: localDate.optional(), to: localDate.optional() });

export const GET = withAuth(async (ctx, req) => {
  const q = querySchema.parse(Object.fromEntries(req.nextUrl.searchParams));
  return json({ items: await ctx.repo.listItems(q) });
});

/** Creates one item, or several at once ({ items: [...] }) for the voice confirmation sheet. */
export const POST = withAuth(async (ctx, req) => {
  const body = await readJson(req);
  if (body && typeof body === "object" && "items" in body) {
    const inputs = z.array(itemInputSchema).min(1).max(20).parse((body as { items: unknown }).items);
    return json({ items: await createItems(ctx, inputs, timingFor(req)) }, 201);
  }
  const [item] = await createItems(ctx, [itemInputSchema.parse(body)], timingFor(req));
  return json({ item }, 201);
});
