import { beforeEach, describe, expect, it } from "vitest";
import { decryptToken, encryptToken, signState, verifyState } from "@/lib/google/crypto";
import { fromGoogleEvent, toGoogleEvent } from "@/lib/google/event-mapping";
import { DemoRepo, resetDemoStore, DEMO_USER } from "@/lib/server/demo-repo";
import { createItem, deleteItem, retrySync, updateItem } from "@/lib/server/items";
import type { AppContext } from "@/lib/server/context";
import type { Item } from "@/lib/domain/types";

describe("token encryption", () => {
  it("round-trips and uses a fresh IV each time", () => {
    const a = encryptToken("1//refresh-token");
    const b = encryptToken("1//refresh-token");
    expect(a).not.toBe(b);
    expect(decryptToken(a)).toBe("1//refresh-token");
  });
  it("detects tampering", () => {
    const sealed = encryptToken("secret");
    const parts = sealed.split(".");
    parts[3] = Buffer.from("other").toString("base64url");
    expect(() => decryptToken(parts.join("."))).toThrow();
  });
  it("signs and verifies OAuth state", () => {
    const s = signState({ uid: "u1", nonce: "n", ts: 1 });
    expect(verifyState<{ uid: string }>(s)?.uid).toBe("u1");
    expect(verifyState(s.replace(/.$/, s.endsWith("A") ? "B" : "A"))).toBeNull();
    expect(verifyState("garbage")).toBeNull();
  });
});

describe("event mapping", () => {
  const item = {
    id: "i1", title: "Müştəri zəngi", notes: "Ramiz", date: "2026-11-10",
    start_at: "2026-11-10T11:00:00.000Z", end_at: "2026-11-10T11:30:00.000Z", all_day: false,
  } as Item;
  it("uses local Baku wall time with the timezone and adds the signature", () => {
    const e = toGoogleEvent(item, "Asia/Baku");
    expect(e.start).toEqual({ dateTime: "2026-11-10T15:00:00", timeZone: "Asia/Baku" });
    expect(e.end).toEqual({ dateTime: "2026-11-10T15:30:00", timeZone: "Asia/Baku" });
    expect(e.description).toBe("Ramiz\n\nCreated with Swift");
    expect(e.reminders).toEqual({ useDefault: true });
  });
  it("all-day events use exclusive end dates", () => {
    const e = toGoogleEvent({ ...item, all_day: true, start_at: null, end_at: null }, "Asia/Baku");
    expect(e.start).toEqual({ date: "2026-11-10" });
    expect(e.end).toEqual({ date: "2026-11-11" });
  });
  it("reads Google events into local days and skips cancelled ones", () => {
    expect(fromGoogleEvent({ id: "x", status: "cancelled", start: { date: "2026-11-10" } })).toBeNull();
    const e = fromGoogleEvent({ id: "y", summary: "Late", start: { dateTime: "2026-11-09T21:30:00Z" }, end: { dateTime: "2026-11-09T22:00:00Z" } }, "Asia/Baku");
    expect(e?.date).toBe("2026-11-10"); // 01:30 next day in Baku
  });
});

describe("calendar sync (demo calendar)", () => {
  let ctx: AppContext;
  beforeEach(async () => {
    resetDemoStore();
    (globalThis as { __swiftDemoGoogle?: unknown }).__swiftDemoGoogle = undefined;
    ctx = { user: DEMO_USER, repo: new DemoRepo(), demo: true };
    await ctx.repo.ensureProfile({ display_name: "x", ui_locale: "az" });
  });
  const connect = () =>
    ctx.repo.saveGoogleConnection({ google_email: "a@b.c", refresh_token_encrypted: "x", calendar_id: "primary", last_error: null, needs_reconnect: false });

  it("events stay local (sync none) when Google isn't connected", async () => {
    const i = await createItem(ctx, { type: "event", title: "A", date: "2026-11-10", start_time: "10:00", priority: "medium", source: "manual" });
    expect(i.sync_status).toBe("none");
    expect(i.google_event_id).toBeNull();
  });

  it("creates, updates, flips type and deletes in Google", async () => {
    await connect();
    const ev = await createItem(ctx, { type: "event", title: "A", date: "2026-11-10", start_time: "10:00", priority: "medium", source: "manual" });
    expect(ev.sync_status).toBe("synced");
    expect(ev.google_event_id).toBe(`swift-${ev.id}`);

    const moved = await updateItem(ctx, ev.id, { start_time: "12:00" });
    expect(moved.sync_status).toBe("synced");

    const done = await updateItem(ctx, ev.id, { status: "done" });
    expect(done.google_event_id).toBe(ev.google_event_id); // completing is app-only

    const asTask = await updateItem(ctx, ev.id, { type: "task" });
    expect(asTask).toMatchObject({ type: "task", google_event_id: null, sync_status: "none" });

    const again = await updateItem(ctx, ev.id, { type: "event", start_time: "18:00" });
    expect(again.sync_status).toBe("synced");
    await deleteItem(ctx, ev.id);
    expect(await ctx.repo.getItem(ev.id)).toBeNull();
  });

  it("a failed sync keeps the item and can be retried", async () => {
    await connect();
    const ev = await createItem(ctx, { type: "event", title: "fail-sync test", date: "2026-11-10", start_time: "10:00", priority: "medium", source: "manual" });
    expect(ev.sync_status).toBe("failed");
    expect(ev.sync_error).toMatch(/simulated/);
    await updateItem(ctx, ev.id, { title: "Fixed" });
    const retried = await retrySync(ctx, ev.id);
    expect(retried.sync_status).toBe("synced");
  });

  it("an event deleted in Google is marked unsynced, not crashed", async () => {
    await connect();
    const ev = await createItem(ctx, { type: "event", title: "B", date: "2026-11-10", start_time: "10:00", priority: "medium", source: "manual" });
    (globalThis as { __swiftDemoGoogle?: Map<string, unknown> }).__swiftDemoGoogle!.delete(ev.google_event_id!);
    const upd = await updateItem(ctx, ev.id, { title: "B2" });
    expect(upd).toMatchObject({ sync_status: "failed", sync_error: "deleted_in_google", google_event_id: null });
  });
});
