"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { useProfile } from "@/lib/client/queries";
import { useTheme } from "@/components/theme/theme-provider";
import { setClientCookie } from "@/lib/cookies";
import { LOCALE_COOKIE } from "@/i18n/config";
import { THEME_COOKIE } from "@/lib/theme";

/**
 * On a device that has never stored a theme/language (fresh install, new phone), adopt the
 * choices saved in the profile. Cookies stay the per-device source of truth afterwards.
 */
export function ProfileSync() {
  const profile = useProfile();
  const locale = useLocale();
  const router = useRouter();
  const { setTheme } = useTheme();
  const done = useRef(false);

  useEffect(() => {
    if (!profile || done.current) return;
    done.current = true;
    const has = (name: string) => document.cookie.split("; ").some((c) => c.startsWith(`${name}=`));
    if (!has(THEME_COOKIE) && profile.theme !== "system") setTheme(profile.theme);
    if (!has(LOCALE_COOKIE)) {
      setClientCookie(LOCALE_COOKIE, profile.ui_locale);
      if (profile.ui_locale !== locale) router.refresh();
    }
  }, [profile, locale, router, setTheme]);

  return null;
}
