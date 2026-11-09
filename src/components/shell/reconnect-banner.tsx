"use client";

import { CalendarX2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useBootstrap } from "@/lib/client/queries";

/** Shown when Google refused our refresh token (revoked, or the 7-day "Testing" limit). */
export function ReconnectBanner() {
  const t = useTranslations("sync");
  const google = useBootstrap().data?.google;
  if (!google?.connected || !google.needs_reconnect) return null;
  return (
    // a plain <a>: the connect route redirects to Google, so it must be a full navigation
    <a
      href="/api/google/connect"
      className="chrome mb-4 flex min-h-12 items-center gap-3 rounded-2xl bg-danger-soft px-4 py-3 text-sm font-semibold text-danger"
    >
      <CalendarX2 className="size-5 shrink-0" aria-hidden />
      {t("reconnect")}
    </a>
  );
}
