import "server-only";
import { applyPatch, buildNewItem, type RuleContext } from "@/lib/domain/rules";
import type { ItemInput, ItemPatch } from "@/lib/domain/schemas";
import type { Item } from "@/lib/domain/types";
import { DEFAULT_TZ } from "@/lib/dates";
import type { AppContext } from "./context";
import { syncItem } from "./sync";
import { NotFoundError } from "./repo";

export async function ruleContext(ctx: AppContext): Promise<RuleContext> {
  const p = await ctx.repo.getProfile();
  return { timezone: p?.timezone ?? DEFAULT_TZ, defaultEventMinutes: p?.default_event_minutes ?? 60 };
}

async function assertCategory(ctx: AppContext, categoryId: string | null | undefined) {
  if (!categoryId) return;
  const cats = await ctx.repo.listCategories();
  if (!cats.some((c) => c.id === categoryId)) throw new NotFoundError("category");
}

export async function createItem(ctx: AppContext, input: ItemInput): Promise<Item> {
  await assertCategory(ctx, input.category_id);
  const row = buildNewItem(input, await ruleContext(ctx));
  const created = await ctx.repo.createItem(row);
  return (await syncItem(ctx, null, created)) ?? created;
}

export async function updateItem(ctx: AppContext, id: string, patch: ItemPatch): Promise<Item> {
  const before = await ctx.repo.getItem(id);
  if (!before) throw new NotFoundError("item");
  if (patch.category_id !== undefined) await assertCategory(ctx, patch.category_id);
  const changes = applyPatch(before, patch, await ruleContext(ctx));
  const after = await ctx.repo.updateItem(id, changes);
  return (await syncItem(ctx, before, after)) ?? after;
}

export async function deleteItem(ctx: AppContext, id: string): Promise<Item> {
  const before = await ctx.repo.getItem(id);
  if (!before) throw new NotFoundError("item");
  await ctx.repo.deleteItem(id);
  await syncItem(ctx, before, null);
  return before;
}

/** Undo of a delete: puts the item back and re-creates its Google event if it had one. */
export async function restoreItem(ctx: AppContext, item: Item): Promise<Item> {
  const restored = await ctx.repo.restoreItem({ ...item, google_event_id: null, sync_status: item.type === "event" ? "pending" : "none" });
  return (await syncItem(ctx, null, restored)) ?? restored;
}

export async function retrySync(ctx: AppContext, id: string): Promise<Item> {
  const item = await ctx.repo.getItem(id);
  if (!item) throw new NotFoundError("item");
  if (item.type !== "event") return ctx.repo.updateItem(id, { sync_status: "none", sync_error: null });
  const pending = await ctx.repo.updateItem(id, { sync_status: "pending" });
  return (await syncItem(ctx, null, pending, { force: item.google_event_id ? "update" : "create" })) ?? pending;
}
