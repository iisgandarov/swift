import { z } from "zod";
import { withAuth, json, readJson } from "@/lib/server/api";
import { categoryInputSchema } from "@/lib/domain/schemas";

export const GET = withAuth(async (ctx) => json({ categories: await ctx.repo.listCategories() }));

export const POST = withAuth(async (ctx, req) => {
  const input = categoryInputSchema.parse(await readJson(req));
  const existing = await ctx.repo.listCategories();
  const category = await ctx.repo.createCategory({ ...input, sort_order: existing.length });
  return json({ category }, 201);
});

/** Reorder: body { order: [id, id, ...] } */
export const PUT = withAuth(async (ctx, req) => {
  const { order } = z.object({ order: z.array(z.uuid()).max(100) }).parse(await readJson(req));
  await Promise.all(order.map((id, i) => ctx.repo.updateCategory(id, { sort_order: i })));
  return json({ categories: await ctx.repo.listCategories() });
});
