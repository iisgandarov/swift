import "server-only";
import { cache } from "react";
import { getLocale } from "next-intl/server";
import { DEFAULT_CATEGORIES, type Profile } from "@/lib/domain/types";
import { createSupabaseServer } from "@/lib/supabase/server";
import { isDemoMode, isEmailAllowed } from "./env";
import { DemoRepo, DEMO_USER } from "./demo-repo";
import { SupabaseRepo } from "./supabase-repo";
import type { Repo } from "./repo";

export interface AppUser {
  id: string;
  email: string;
  name: string;
}

export interface AppContext {
  user: AppUser;
  repo: Repo;
  demo: boolean;
}

/** Resolves the signed-in, allowed user and their repo. Returns null when signed out or not allowed. */
export const getAppContext = cache(async (): Promise<AppContext | null> => {
  if (isDemoMode()) {
    return { user: DEMO_USER, repo: new DemoRepo(), demo: true };
  }
  const db = await createSupabaseServer();
  // getClaims verifies the session JWT's signature (locally with the project's signing keys,
  // or via the Auth server for legacy secrets) — no extra round trip in the common case.
  const { data, error } = await db.auth.getClaims();
  const claims = data?.claims;
  if (error || !claims?.sub) return null;
  const email = typeof claims.email === "string" ? claims.email : "";
  if (!isEmailAllowed(email)) return null;
  const meta = claims.user_metadata as { full_name?: string; name?: string } | undefined;
  return {
    user: { id: claims.sub, email, name: meta?.full_name ?? meta?.name ?? email.split("@")[0] },
    repo: new SupabaseRepo(db, claims.sub),
    demo: false,
  };
});

/** First-run setup: profile row + default categories. Idempotent. */
export async function ensureUserSetup(ctx: AppContext): Promise<Profile> {
  const locale = (await getLocale()) === "en" ? "en" : "az";
  const firstName = ctx.user.name.split(" ")[0] ?? "";
  const profile = await ctx.repo.ensureProfile({ display_name: firstName, ui_locale: locale });
  const cats = await ctx.repo.listCategories();
  if (cats.length === 0) {
    await ctx.repo.createCategories(DEFAULT_CATEGORIES.map((c, i) => ({ ...c, sort_order: i })));
  }
  return profile;
}
