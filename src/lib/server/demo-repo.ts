import "server-only";
import type { Category, FocusSession, GoogleConnection, Item, Profile } from "@/lib/domain/types";
import { DEFAULT_CATEGORIES } from "@/lib/domain/types";
import { addDays, localToUtcIso, todayLocal } from "@/lib/dates";
import { NotFoundError, type ItemQuery, type NewItemRow, type Repo } from "./repo";

export const DEMO_USER = { id: "00000000-0000-4000-8000-000000000001", email: "demo@swift.local", name: "İsrafil" };

interface DemoStore {
  profile: Profile | null;
  categories: Category[];
  items: Item[];
  focus: FocusSession[];
  google: GoogleConnection | null;
  ai: { kind: string; at: string }[];
}

const g = globalThis as unknown as { __swiftDemo?: DemoStore };

function seedItems(cats: Category[]): Item[] {
  const tz = "Asia/Baku";
  const today = todayLocal(tz);
  const cat = (en: string) => cats.find((c) => c.name_en === en)?.id ?? null;
  const now = new Date().toISOString();
  const base = {
    user_id: DEMO_USER.id, notes: null, all_day: false, status: "open" as const, completed_at: null,
    source: "manual" as const, raw_transcript: null, language: "az", google_event_id: null,
    sync_status: "none" as const, sync_error: null, created_at: now, updated_at: now,
  };
  const ev = (id: string, title: string, date: string, s: string, e: string, category: string | null, extra: Partial<Item> = {}): Item => ({
    ...base, id, type: "event", title, date, start_at: localToUtcIso(date, s, tz), end_at: localToUtcIso(date, e, tz),
    priority: "medium", category_id: category, ...extra,
  });
  const task = (id: string, title: string, date: string | null, category: string | null, extra: Partial<Item> = {}): Item => ({
    ...base, id, type: "task", title, date, start_at: null, end_at: null, priority: "medium", category_id: category, ...extra,
  });
  return [
    ev("d0000000-0000-4000-8000-000000000001", "Homepage üçün UI dizayn", today, "09:00", "11:00", cat("Work")),
    ev("d0000000-0000-4000-8000-000000000002", "Komanda görüşü", today, "11:00", "12:00", cat("Meeting"), {
      status: "done", completed_at: now,
    }),
    ev("d0000000-0000-4000-8000-000000000003", "İdman", today, "17:00", "18:00", cat("Personal"), { priority: "low" }),
    ev("d0000000-0000-4000-8000-000000000004", "Kitab oxu", today, "20:00", "21:00", cat("Personal"), { priority: "low" }),
    task("d0000000-0000-4000-8000-000000000005", "TLB postunu yaz", addDays(today, -1), cat("TLB Academy")),
    ev("d0000000-0000-4000-8000-000000000006", "EduPo demo — Ramiz", addDays(today, 1), "10:00", "11:00", cat("EduPo")),
    task("d0000000-0000-4000-8000-000000000007", "Power BI hesabatını bitir", addDays(today, 3), cat("Work"), { priority: "high" }),
  ];
}

function store(): DemoStore {
  if (!g.__swiftDemo) {
    const categories: Category[] = DEFAULT_CATEGORIES.map((c, i) => ({
      ...c,
      id: `c0000000-0000-4000-8000-00000000000${i + 1}`,
      user_id: DEMO_USER.id,
      sort_order: i,
    }));
    g.__swiftDemo = {
      profile: null,
      categories,
      items: process.env.SWIFT_DEMO_EMPTY === "1" ? [] : seedItems(categories),
      focus: [],
      google: null,
      ai: [],
    };
  }
  return g.__swiftDemo;
}

/** Test hook: wipe the demo store (used by e2e). */
export function resetDemoStore() {
  g.__swiftDemo = undefined;
}

const clone = <T,>(v: T): T => structuredClone(v);

export class DemoRepo implements Repo {
  readonly userId = DEMO_USER.id;

  async getProfile() {
    return clone(store().profile);
  }

  async ensureProfile(defaults: Pick<Profile, "display_name" | "ui_locale">) {
    const s = store();
    s.profile ??= {
      id: this.userId,
      display_name: defaults.display_name,
      ui_locale: defaults.ui_locale,
      voice_locale: "auto",
      theme: "system",
      timezone: "Asia/Baku",
      default_event_minutes: 60,
      time_format: "24h",
      auto_create: false,
      created_at: new Date().toISOString(),
    };
    return clone(s.profile);
  }

  async updateProfile(patch: Partial<Profile>) {
    const s = store();
    if (!s.profile) throw new NotFoundError("profile");
    Object.assign(s.profile, patch);
    return clone(s.profile);
  }

  async listCategories() {
    return clone([...store().categories].sort((a, b) => a.sort_order - b.sort_order));
  }

  async createCategory(input: Partial<Category>) {
    const s = store();
    const c: Category = {
      id: crypto.randomUUID(),
      user_id: this.userId,
      name_az: input.name_az ?? "",
      name_en: input.name_en ?? "",
      color: input.color ?? "blue",
      icon: input.icon ?? null,
      sort_order: input.sort_order ?? s.categories.length,
    };
    s.categories.push(c);
    return clone(c);
  }

  async createCategories(inputs: Partial<Category>[]) {
    const out: Category[] = [];
    for (const i of inputs) out.push(await this.createCategory(i));
    return out;
  }

  async updateCategory(id: string, patch: Partial<Category>) {
    const c = store().categories.find((x) => x.id === id);
    if (!c) throw new NotFoundError("category");
    Object.assign(c, patch, { id, user_id: this.userId });
    return clone(c);
  }

  async deleteCategory(id: string) {
    const s = store();
    s.categories = s.categories.filter((c) => c.id !== id);
    s.items.forEach((i) => {
      if (i.category_id === id) i.category_id = null;
    });
  }

  async listItems(q: ItemQuery = {}) {
    const items = store().items.filter((i) => {
      if (q.from && q.to) return i.date !== null && i.date >= q.from && i.date <= q.to;
      return true;
    });
    return clone(items);
  }

  async getItem(id: string) {
    return clone(store().items.find((i) => i.id === id) ?? null);
  }

  async createItem(row: NewItemRow) {
    const now = new Date().toISOString();
    const item: Item = {
      google_event_id: null,
      sync_error: null,
      ...row,
      id: crypto.randomUUID(),
      user_id: this.userId,
      created_at: now,
      updated_at: now,
    };
    store().items.push(item);
    return clone(item);
  }

  async updateItem(id: string, patch: Partial<Item>) {
    const item = store().items.find((i) => i.id === id);
    if (!item) throw new NotFoundError("item");
    Object.assign(item, patch, { id, user_id: this.userId, updated_at: new Date().toISOString() });
    return clone(item);
  }

  async deleteItem(id: string) {
    const s = store();
    s.items = s.items.filter((i) => i.id !== id);
  }

  async restoreItem(item: Item) {
    const s = store();
    s.items = s.items.filter((i) => i.id !== item.id);
    const restored = { ...item, user_id: this.userId, updated_at: new Date().toISOString() };
    s.items.push(restored);
    return clone(restored);
  }

  async listFocusSessions(sinceIso: string) {
    return clone(store().focus.filter((f) => f.started_at >= sinceIso));
  }

  async createFocusSession(input: Omit<FocusSession, "id" | "user_id">) {
    const f: FocusSession = { ...input, item_id: input.item_id ?? null, id: crypto.randomUUID(), user_id: this.userId };
    store().focus.push(f);
    return clone(f);
  }

  async getGoogleConnection() {
    return clone(store().google);
  }

  async saveGoogleConnection(conn: Omit<GoogleConnection, "user_id" | "connected_at"> & { connected_at?: string }) {
    store().google = { ...conn, user_id: this.userId, connected_at: conn.connected_at ?? new Date().toISOString() };
  }

  async updateGoogleConnection(patch: Partial<Omit<GoogleConnection, "user_id">>) {
    const s = store();
    if (s.google) Object.assign(s.google, patch);
  }

  async deleteGoogleConnection() {
    store().google = null;
  }

  async countAiRequestsSince(sinceIso: string) {
    return store().ai.filter((a) => a.at >= sinceIso).length;
  }

  async logAiRequest(kind: "voice" | "parse") {
    store().ai.push({ kind, at: new Date().toISOString() });
  }
}
