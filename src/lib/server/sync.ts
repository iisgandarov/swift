import "server-only";
import { planSync, type SyncAction } from "@/lib/domain/rules";
import type { Item } from "@/lib/domain/types";
import type { AppContext } from "./context";
import { getCalendarClient } from "@/lib/google/client";

/**
 * Pushes an item change to Google Calendar. Never throws: on failure the item keeps its
 * local data and gets sync_status = "failed" so the UI can offer a retry.
 */
export async function syncItem(
  ctx: AppContext,
  before: Item | null,
  after: Item | null,
  opts: { force?: SyncAction } = {},
): Promise<Item | null> {
  const action = opts.force ?? planSync(before, after);
  if (action === "none") {
    // an event that was pending but nothing to do (e.g. no change) stays as is
    return after;
  }

  const calendar = await getCalendarClient(ctx);
  if (!calendar) {
    // Not connected: events live only in the app. Clear any stale pending flag.
    if (after && after.sync_status === "pending") {
      return ctx.repo.updateItem(after.id, { sync_status: "none", sync_error: null });
    }
    return after;
  }

  try {
    if (action === "delete") {
      const id = before?.google_event_id;
      if (id) await calendar.deleteEvent(id);
      if (after) return ctx.repo.updateItem(after.id, { google_event_id: null, sync_status: "none", sync_error: null });
      return null;
    }
    if (!after) return null;
    if (action === "create") {
      const googleId = await calendar.createEvent(after);
      return ctx.repo.updateItem(after.id, { google_event_id: googleId, sync_status: "synced", sync_error: null });
    }
    // update
    const result = await calendar.updateEvent(after.google_event_id!, after);
    if (result === "gone") {
      // deleted in Google: mark as unsynced rather than re-creating behind the user's back
      return ctx.repo.updateItem(after.id, { google_event_id: null, sync_status: "failed", sync_error: "deleted_in_google" });
    }
    return ctx.repo.updateItem(after.id, { sync_status: "synced", sync_error: null });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[sync]", action, message);
    if (!after) return null; // deletion: the item is gone locally anyway
    return ctx.repo.updateItem(after.id, { sync_status: "failed", sync_error: message.slice(0, 500) });
  }
}
