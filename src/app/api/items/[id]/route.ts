import { z } from "zod";
import { withAuth, json, readJson } from "@/lib/server/api";
import { itemPatchSchema } from "@/lib/domain/schemas";
import { deleteItem, updateItem } from "@/lib/server/items";

type Params = { id: string };
const id = z.uuid();

export const PATCH = withAuth<Params>(async (ctx, req, params) => {
  const patch = itemPatchSchema.parse(await readJson(req));
  return json({ item: await updateItem(ctx, id.parse(params.id), patch) });
});

export const DELETE = withAuth<Params>(async (ctx, _req, params) => {
  const deleted = await deleteItem(ctx, id.parse(params.id));
  return json({ item: deleted });
});
