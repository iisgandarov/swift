import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Category, FocusSession, GoogleConnection, Item, Profile } from "@/lib/domain/types";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { addDays, todayLocal } from "@/lib/dates";
import { NotFoundError, type ItemQuery, type NewItemRow, type Repo } from "./repo";

function must<T>(res: { data: T | null; error: { message: string; code?: string } | null }, what: string): T {
  if (res.error) {
    if (res.error.code === "PGRST116") throw new NotFoundError(what);
    throw new Error(`${what}: ${res.error.message}`);
  }
  if (res.data === null) throw new NotFoundError(what);
  return res.data;
}

/** Window of done items shown in the app (older completed items stay in the DB for stats/export). */
const DONE_WINDOW_DAYS = 90;

export class SupabaseRepo implements Repo {
  constructor(
    private db: SupabaseClient,
    public readonly userId: string,
  ) {}

  private admin() {
    return createSupabaseAdmin();
  }

  async getProfile() {
    const { data, error } = await this.db.from("profiles").select("*").eq("id", this.userId).maybeSingle();
    if (error) throw new Error(error.message);
    return (data as Profile | null) ?? null;
  }

  async ensureProfile(defaults: Pick<Profile, "display_name" | "ui_locale">) {
    const existing = await this.getProfile();
    if (existing) return existing;
    const res = await this.db
      .from("profiles")
      .upsert({ id: this.userId, ...defaults }, { onConflict: "id", ignoreDuplicates: true })
      .select("*")
      .maybeSingle();
    if (res.error) throw new Error(res.error.message);
    return (res.data as Profile | null) ?? ((await this.getProfile()) as Profile);
  }

  async updateProfile(patch: Partial<Profile>) {
    return must(await this.db.from("profiles").update(patch).eq("id", this.userId).select("*").single(), "profile") as Profile;
  }

  async listCategories() {
    return must(
      await this.db.from("categories").select("*").eq("user_id", this.userId).order("sort_order"),
      "categories",
    ) as Category[];
  }

  async createCategory(input: Partial<Category>) {
    return must(
      await this.db.from("categories").insert({ ...input, user_id: this.userId }).select("*").single(),
      "category",
    ) as Category;
  }

  async createCategories(inputs: Partial<Category>[]) {
    return must(
      await this.db.from("categories").insert(inputs.map((i) => ({ ...i, user_id: this.userId }))).select("*"),
      "categories",
    ) as Category[];
  }

  async updateCategory(id: string, patch: Partial<Category>) {
    return must(
      await this.db.from("categories").update(patch).eq("id", id).eq("user_id", this.userId).select("*").single(),
      "category",
    ) as Category;
  }

  async deleteCategory(id: string) {
    const { error } = await this.db.from("categories").delete().eq("id", id).eq("user_id", this.userId);
    if (error) throw new Error(error.message);
  }

  async listItems(q: ItemQuery = {}) {
    let query = this.db.from("items").select("*").eq("user_id", this.userId);
    if (q.all) {
      // no filter
    } else if (q.from && q.to) {
      query = query.gte("date", q.from).lte("date", q.to);
    } else {
      const since = addDays(todayLocal(), -DONE_WINDOW_DAYS);
      query = query.or(`status.eq.open,completed_at.gte.${since}`);
    }
    return must(await query.order("date", { nullsFirst: false }).order("start_at").limit(q.all ? 20000 : 2000), "items") as Item[];
  }

  async getItem(id: string) {
    const { data, error } = await this.db.from("items").select("*").eq("id", id).eq("user_id", this.userId).maybeSingle();
    if (error) throw new Error(error.message);
    return (data as Item | null) ?? null;
  }

  async createItem(row: NewItemRow) {
    return must(await this.db.from("items").insert({ ...row, user_id: this.userId }).select("*").single(), "item") as Item;
  }

  async updateItem(id: string, patch: Partial<Item>) {
    const { id: _i, user_id: _u, created_at: _c, updated_at: _up, ...rest } = patch;
    return must(
      await this.db.from("items").update(rest).eq("id", id).eq("user_id", this.userId).select("*").single(),
      "item",
    ) as Item;
  }

  async deleteItem(id: string) {
    const { error } = await this.db.from("items").delete().eq("id", id).eq("user_id", this.userId);
    if (error) throw new Error(error.message);
  }

  async restoreItem(item: Item) {
    const { updated_at: _u, ...rest } = item;
    return must(
      await this.db.from("items").upsert({ ...rest, user_id: this.userId }).select("*").single(),
      "item",
    ) as Item;
  }

  async listFocusSessions(sinceIso: string) {
    return must(
      await this.db.from("focus_sessions").select("*").eq("user_id", this.userId).gte("started_at", sinceIso).order("started_at"),
      "focus_sessions",
    ) as FocusSession[];
  }

  async createFocusSession(input: Omit<FocusSession, "id" | "user_id">) {
    return must(
      await this.db.from("focus_sessions").insert({ ...input, user_id: this.userId }).select("*").single(),
      "focus_session",
    ) as FocusSession;
  }

  // google_connections has no RLS policies for clients: service role only.
  async getGoogleConnection() {
    const { data, error } = await this.admin().from("google_connections").select("*").eq("user_id", this.userId).maybeSingle();
    if (error) throw new Error(error.message);
    return (data as GoogleConnection | null) ?? null;
  }

  async saveGoogleConnection(conn: Omit<GoogleConnection, "user_id" | "connected_at"> & { connected_at?: string }) {
    const { error } = await this.admin()
      .from("google_connections")
      .upsert({ ...conn, user_id: this.userId, connected_at: conn.connected_at ?? new Date().toISOString() });
    if (error) throw new Error(error.message);
  }

  async updateGoogleConnection(patch: Partial<Omit<GoogleConnection, "user_id">>) {
    const { error } = await this.admin().from("google_connections").update(patch).eq("user_id", this.userId);
    if (error) throw new Error(error.message);
  }

  async deleteGoogleConnection() {
    const { error } = await this.admin().from("google_connections").delete().eq("user_id", this.userId);
    if (error) throw new Error(error.message);
  }

  async countAiRequestsSince(sinceIso: string) {
    const { count, error } = await this.db
      .from("ai_requests")
      .select("id", { count: "exact", head: true })
      .eq("user_id", this.userId)
      .gte("created_at", sinceIso);
    if (error) throw new Error(error.message);
    return count ?? 0;
  }

  async logAiRequest(kind: "voice" | "parse") {
    const { error } = await this.db.from("ai_requests").insert({ user_id: this.userId, kind });
    if (error) throw new Error(error.message);
  }
}
