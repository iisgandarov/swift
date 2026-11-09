import { cookies } from "next/headers";
import { withAuth, json, readJson } from "@/lib/server/api";
import { profilePatchSchema } from "@/lib/domain/schemas";
import { LOCALE_COOKIE } from "@/i18n/config";
import { THEME_COOKIE } from "@/lib/theme";

const YEAR = 60 * 60 * 24 * 365;

export const PATCH = withAuth(async (ctx, req) => {
  const patch = profilePatchSchema.parse(await readJson(req));
  const profile = await ctx.repo.updateProfile(patch);
  // cookies drive SSR language and the no-flash theme script
  const jar = await cookies();
  if (patch.ui_locale) jar.set(LOCALE_COOKIE, patch.ui_locale, { path: "/", maxAge: YEAR, sameSite: "lax" });
  if (patch.theme) jar.set(THEME_COOKIE, patch.theme, { path: "/", maxAge: YEAR, sameSite: "lax" });
  return json({ profile });
});
