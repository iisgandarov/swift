import "server-only";
import { applyPatch, buildNewItem, type RuleContext } from "@/lib/domain/rules";
import type { ItemInput, ItemPatch } from "@/lib/domain/schemas";
import type { Item } from "@/lib/domain/types";
import { DEFAULT_TZ } from "@/lib/dates";
import type { AppContext } from "./context";
import { syncItem } from "./sync";
import { runAfterResponse } from "./background";
import { googleConfigured } from "./env";
import { NotFoundError } from "./repo";
import type { Timing } from "./timing";

export async function ruleContext(ctx: AppContext): Promise<RuleContext> {
  const p = await ctx.repo.getProfile();
  return { timezone: p?.timezone ?? DEFAULT_TZ, defaultEventMinutes: p?.default_event_minutes ?? 60 };
}

async function assertCategory(ctx: AppContext, categoryId: string | null | undefined) {
  if (!categoryId) return;
  const cats = await ctx.repo.listCategories();
  if (!cats.some((c) => c.id === categoryId)) throw new NotFoundError("category");
}

/** Whether new events will be pushed to Google Calendar (connected, possibly needing a reconnect). */
async function calendarConnected(ctx: AppContext) {
  if (!ctx.demo && !googleConfigured()) return false;
  return Boolean(await ctx.repo.getGoogleConnection());
}

/**
 * Creates one or more items with as few round trips as possible: the category check, the rule
 * context and the Calendar connection are looked up together, the rows go in one insert, and
 * the Google Calendar sync runs after the response (events show "syncing" until it's done;
 * failures still end as sync_status = failed with Retry, so nothing is lost).
 */
export async function createItems(ctx: AppContext, inputs: ItemInput[], timing?: Timing): Promise<Item[]> {
  const t = <T,>(name: string, p: Promise<T>) => (timing ? timing.time(name, p) : p);
  const wantsCategory = inputs.some((i) => i.category_id);
  const hasEvents = (rows: { type: string }[]) => rows.some((r) => r.type === "event");
  const [cats, rules, calendar] = await t(
    "prepare",
    Promise.all([
      wantsCategory ? ctx.repo.listCategories() : Promise.resolve([]),
      ruleContext(ctx),
      calendarConnected(ctx),
    ]),
  );
  for (const input of inputs) {
    if (input.category_id && !cats.some((c) => c.id === input.category_id)) throw new NotFoundError("category");
  }
  // without a Calendar connection, events are app-only right away (no "syncing" state)
  const rows = inputs.map((input) => {
    const row = buildNewItem(input, rules);
    return !calendar && row.sync_status === "pending" ? { ...row, sync_status: "none" as const } : row;
  });
  const created = await t("insert", ctx.repo.createItems(rows));
  if (calendar && hasEvents(created)) {
    runAfterResponse("sync", async () => {
      for (const item of created) if (item.sync_status === "pending") await syncItem(ctx, null, item);
    });
  }
  return created;
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
