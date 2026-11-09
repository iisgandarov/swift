import { z } from "zod";
import { withAuth, json, readJson } from "@/lib/server/api";
import { restoreItem } from "@/lib/server/items";
import { ITEM_STATUSES, ITEM_TYPES, PRIORITIES, SOURCES, SYNC_STATUSES } from "@/lib/domain/types";

/** Undo for delete: the client sends back the item it got from DELETE. */
const itemSchema = z.object({
  id: z.uuid(),
  user_id: z.string(),
  type: z.enum(ITEM_TYPES),
  title: z.string().min(1).max(200),
  notes: z.string().max(4000).nullable(),
  date: z.string().nullable(),
  start_at: z.string().nullable(),
  end_at: z.string().nullable(),
  all_day: z.boolean(),
  priority: z.enum(PRIORITIES),
  category_id: z.string().nullable(),
  status: z.enum(ITEM_STATUSES),
  completed_at: z.string().nullable(),
  source: z.enum(SOURCES),
  raw_transcript: z.string().nullable(),
  language: z.string().nullable(),
  google_event_id: z.string().nullable(),
  sync_status: z.enum(SYNC_STATUSES),
  sync_error: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const POST = withAuth(async (ctx, req) => {
  const item = itemSchema.parse(await readJson(req));
  return json({ item: await restoreItem(ctx, item) }, 201);
});
