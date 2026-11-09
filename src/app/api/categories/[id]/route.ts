import { z } from "zod";
import { withAuth, json, readJson } from "@/lib/server/api";
import { categoryInputSchema } from "@/lib/domain/schemas";

type Params = { id: string };

export const PATCH = withAuth<Params>(async (ctx, req, params) => {
  const patch = categoryInputSchema.partial().parse(await readJson(req));
  return json({ category: await ctx.repo.updateCategory(z.uuid().parse(params.id), patch) });
});

export const DELETE = withAuth<Params>(async (ctx, _req, params) => {
  await ctx.repo.deleteCategory(z.uuid().parse(params.id));
  return json({ ok: true });
});
