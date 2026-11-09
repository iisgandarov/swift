export const ITEM_TYPES = ["task", "event"] as const;
export const PRIORITIES = ["low", "medium", "high"] as const;
export const ITEM_STATUSES = ["open", "done"] as const;
export const SOURCES = ["voice", "text", "manual"] as const;
export const SYNC_STATUSES = ["none", "pending", "synced", "failed"] as const;
export const CATEGORY_COLORS = ["blue", "purple", "green", "amber", "orange", "pink", "teal", "slate"] as const;

export type ItemType = (typeof ITEM_TYPES)[number];
export type Priority = (typeof PRIORITIES)[number];
export type ItemStatus = (typeof ITEM_STATUSES)[number];
export type ItemSource = (typeof SOURCES)[number];
export type SyncStatus = (typeof SYNC_STATUSES)[number];
export type CategoryColor = (typeof CATEGORY_COLORS)[number];

/** ISO date "YYYY-MM-DD" in the user's timezone. */
export type LocalDate = string;
/** "HH:mm" wall-clock time in the user's timezone. */
export type LocalTime = string;

export interface Item {
  id: string;
  user_id: string;
  type: ItemType;
  title: string;
  notes: string | null;
  date: LocalDate | null;
  start_at: string | null; // ISO timestamp (UTC)
  end_at: string | null;
  all_day: boolean;
  priority: Priority;
  category_id: string | null;
  status: ItemStatus;
  completed_at: string | null;
  source: ItemSource;
  raw_transcript: string | null;
  language: string | null;
  google_event_id: string | null;
  sync_status: SyncStatus;
  sync_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  user_id: string;
  name_az: string;
  name_en: string;
  color: CategoryColor;
  icon: string | null;
  sort_order: number;
}

export interface Profile {
  id: string;
  display_name: string;
  ui_locale: "az" | "en";
  voice_locale: "auto" | "az" | "en";
  theme: "system" | "light" | "dark";
  timezone: string;
  default_event_minutes: number;
  time_format: "24h" | "12h";
  auto_create: boolean;
  created_at: string;
}

export interface FocusSession {
  id: string;
  user_id: string;
  item_id: string | null;
  started_at: string;
  planned_minutes: number;
  actual_minutes: number;
  completed: boolean;
}

export interface GoogleConnection {
  user_id: string;
  google_email: string | null;
  refresh_token_encrypted: string;
  calendar_id: string;
  connected_at: string;
  last_error: string | null;
  needs_reconnect: boolean;
}

/** What the client is allowed to see about the Google connection (never the token). */
export interface GoogleStatus {
  connected: boolean;
  email: string | null;
  calendar_id: string | null;
  needs_reconnect: boolean;
  last_error: string | null;
  configured: boolean; // server has Google OAuth credentials at all
}

export const DEFAULT_CATEGORIES: Pick<Category, "name_az" | "name_en" | "color" | "icon">[] = [
  { name_az: "İş", name_en: "Work", color: "blue", icon: "briefcase" },
  { name_az: "Görüş", name_en: "Meeting", color: "purple", icon: "users" },
  { name_az: "Şəxsi", name_en: "Personal", color: "green", icon: "heart" },
  { name_az: "EduPo", name_en: "EduPo", color: "orange", icon: "graduation-cap" },
  { name_az: "TLB Academy", name_en: "TLB Academy", color: "teal", icon: "book-open" },
];
