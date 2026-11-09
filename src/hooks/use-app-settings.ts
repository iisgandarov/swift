"use client";

import { useEffect, useState } from "react";
import { useLocale } from "next-intl";
import { DEFAULT_TZ, zonedParts, type UiLocale } from "@/lib/dates";
import { useProfile } from "@/lib/client/queries";

/** Ticks once a minute so greetings, "today" and overdue state stay correct while the app is open. */
export function useNow(intervalMs = 60_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    const onVisible = () => document.visibilityState === "visible" && setNow(Date.now());
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [intervalMs]);
  return now;
}

export function useAppSettings() {
  const locale = useLocale() as UiLocale;
  const profile = useProfile();
  const now = useNow();
  const tz = profile?.timezone ?? DEFAULT_TZ;
  const parts = zonedParts(tz, now);
  return {
    locale,
    tz,
    timeFormat: profile?.time_format ?? "24h",
    defaultEventMinutes: profile?.default_event_minutes ?? 60,
    today: parts.date,
    hour: parts.hour,
    nowTime: parts.time,
    now,
    profile,
  };
}
