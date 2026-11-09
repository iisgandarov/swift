import { z } from "zod";
import { CATEGORY_COLORS, ITEM_TYPES, PRIORITIES, SOURCES } from "./types";

export const localDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD");
export const localTime = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "HH:mm");

/**
 * Item input as the UI thinks about it: a local date + optional local times.
 * The server turns it into start_at/end_at using the user's timezone.
 */
export const itemInputSchema = z.object({
  type: z.enum(ITEM_TYPES),
  title: z.string().trim().min(1).max(200),
  notes: z.string().trim().max(4000).nullish(),
  date: localDate.nullish(),
  start_time: localTime.nullish(),
  end_time: localTime.nullish(),
  duration_minutes: z.number().int().min(5).max(24 * 60).nullish(),
  all_day: z.boolean().optional(),
  priority: z.enum(PRIORITIES).default("medium"),
  category_id: z.uuid().nullish(),
  source: z.enum(SOURCES).default("manual"),
  raw_transcript: z.string().max(5000).nullish(),
  language: z.enum(["az", "en"]).nullish(),
});
export type ItemInput = z.infer<typeof itemInputSchema>;

export const itemPatchSchema = itemInputSchema
  .partial()
  .omit({ source: true, raw_transcript: true, language: true })
  .extend({ status: z.enum(["open", "done"]).optional() });
export type ItemPatch = z.infer<typeof itemPatchSchema>;

export const categoryInputSchema = z.object({
  name_az: z.string().trim().min(1).max(40),
  name_en: z.string().trim().min(1).max(40),
  color: z.enum(CATEGORY_COLORS),
  icon: z.string().max(40).nullish(),
});
export type CategoryInput = z.infer<typeof categoryInputSchema>;

export const profilePatchSchema = z
  .object({
    display_name: z.string().trim().max(60),
    ui_locale: z.enum(["az", "en"]),
    voice_locale: z.enum(["auto", "az", "en"]),
    theme: z.enum(["system", "light", "dark"]),
    default_event_minutes: z.union([z.literal(30), z.literal(45), z.literal(60), z.literal(90)]),
    time_format: z.enum(["24h", "12h"]),
    auto_create: z.boolean(),
  })
  .partial();
export type ProfilePatch = z.infer<typeof profilePatchSchema>;

export const focusSessionInputSchema = z.object({
  item_id: z.uuid().nullish(),
  started_at: z.iso.datetime(),
  planned_minutes: z.number().int().min(1).max(240),
  actual_minutes: z.number().int().min(0).max(600),
  completed: z.boolean(),
});
export type FocusSessionInput = z.infer<typeof focusSessionInputSchema>;
