import type { Category, FocusSession, GoogleConnection, Item, Profile } from "@/lib/domain/types";
import type { CategoryInput, FocusSessionInput, ProfilePatch } from "@/lib/domain/schemas";

export type NewItemRow = Omit<Item, "id" | "user_id" | "created_at" | "updated_at" | "google_event_id" | "sync_error"> &
  Partial<Pick<Item, "google_event_id" | "sync_error">>;

export interface ItemQuery {
  /** Inclusive local date range; when absent the "working set" is returned. */
  from?: string;
  to?: string;
  /** every item, for export */
  all?: boolean;
}

/**
 * Storage boundary. Route handlers only talk to this interface, so the app runs
 * against Supabase in production and an in-memory store in demo mode.
 * Every method is scoped to the signed-in user.
 */
export interface Repo {
  readonly userId: string;

  getProfile(): Promise<Profile | null>;
  ensureProfile(defaults: Pick<Profile, "display_name" | "ui_locale">): Promise<Profile>;
  updateProfile(patch: ProfilePatch): Promise<Profile>;

  listCategories(): Promise<Category[]>;
  createCategory(input: CategoryInput & { sort_order?: number }): Promise<Category>;
  createCategories(inputs: (CategoryInput & { sort_order: number })[]): Promise<Category[]>;
  updateCategory(id: string, patch: Partial<CategoryInput> & { sort_order?: number }): Promise<Category>;
  deleteCategory(id: string): Promise<void>;

  listItems(q?: ItemQuery): Promise<Item[]>;
  getItem(id: string): Promise<Item | null>;
  createItem(row: NewItemRow): Promise<Item>;
  /** Several items in one insert (one round trip), returned in the same order. */
  createItems(rows: NewItemRow[]): Promise<Item[]>;
  updateItem(id: string, patch: Partial<Item>): Promise<Item>;
  deleteItem(id: string): Promise<void>;
  /** Restores a previously deleted item (undo), keeping its id. */
  restoreItem(item: Item): Promise<Item>;

  listFocusSessions(sinceIso: string): Promise<FocusSession[]>;
  createFocusSession(input: FocusSessionInput): Promise<FocusSession>;

  getGoogleConnection(): Promise<GoogleConnection | null>;
  saveGoogleConnection(conn: Omit<GoogleConnection, "user_id" | "connected_at"> & { connected_at?: string }): Promise<void>;
  updateGoogleConnection(patch: Partial<Omit<GoogleConnection, "user_id">>): Promise<void>;
  deleteGoogleConnection(): Promise<void>;

  countAiRequestsSince(sinceIso: string): Promise<number>;
  logAiRequest(kind: "voice" | "parse"): Promise<void>;
}

export class NotFoundError extends Error {
  constructor(what = "not found") {
    super(what);
  }
}
