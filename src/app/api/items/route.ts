import { z } from "zod";
import { withAuth, json, readJson } from "@/lib/server/api";
import { itemInputSchema, localDate } from "@/lib/domain/schemas";
import { createItem } from "@/lib/server/items";
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
    const items = [];
    for (const input of inputs) items.push(await createItem(ctx, input, timingFor(req)));
    return json({ items }, 201);
  }
  return json({ item: await createItem(ctx, itemInputSchema.parse(body), timingFor(req)) }, 201);
});
