"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { CalendarCheck2, CalendarX2, ChevronRight } from "lucide-react";
import { useBootstrap, useGoogleCalendars, useGoogleMutations } from "@/lib/client/queries";
import { OptionSheet } from "@/components/pickers/option-sheet";
import { Button } from "@/components/ui/button";

export function GoogleSection() {
  const t = useTranslations("settings");
  const ts = useTranslations("sync");
  const params = useSearchParams();
  const google = useBootstrap().data?.google;
  const connected = Boolean(google?.connected && !google.needs_reconnect);
  const calendars = useGoogleCalendars(connected);
  const m = useGoogleMutations();
  const [pick, setPick] = useState(false);
  const result = params.get("google");
  const qc = useQueryClient();

  // back from the OAuth round-trip: refresh the cached connection status
  useEffect(() => {
    if (result) qc.invalidateQueries({ queryKey: ["bootstrap"] });
  }, [result, qc]);

  if (!google) return null;
  const currentCal = calendars.data?.calendars.find((c) => c.id === google.calendar_id);

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3">
        {connected ? (
          <CalendarCheck2 className="mt-0.5 size-5 shrink-0 text-success" aria-hidden />
        ) : (
          <CalendarX2 className="mt-0.5 size-5 shrink-0 text-muted" aria-hidden />
        )}
        <p className="text-[15px] text-muted">
          {google.needs_reconnect
            ? ts("reconnect")
            : connected
              ? t("googleConnected", { email: google.email ?? "Google" })
              : t("googleNotConnected")}
        </p>
      </div>

      {result && result !== "connected" && (
        <p role="alert" className="rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">
          {result === "not_configured" ? t("googleNotConfigured") : ts("failed")}
        </p>
      )}

      {connected && (
        <button type="button" onClick={() => setPick(true)} className="flex min-h-12 w-full items-center justify-between gap-3 text-left">
          <span>
            <span className="block text-[15px] font-medium">{t("targetCalendar")}</span>
            <span className="text-sm text-muted">{currentCal?.summary ?? google.calendar_id ?? "primary"}</span>
          </span>
          <ChevronRight className="size-5 text-subtle" aria-hidden />
        </button>
      )}

      <div className="flex gap-3">
        {!connected || google.needs_reconnect ? (
          <a
            href="/api/google/connect"
            className="inline-flex h-11 items-center justify-center rounded-full bg-primary px-5 text-[15px] font-semibold text-white"
          >
            {t("googleConnect")}
          </a>
        ) : null}
        {google.connected && (
          <Button variant="secondary" onClick={() => m.disconnect.mutate()} disabled={m.disconnect.isPending}>
            {t("googleDisconnect")}
          </Button>
        )}
      </div>

      <OptionSheet
        open={pick}
        onClose={() => setPick(false)}
        title={t("targetCalendar")}
        value={google.calendar_id ?? "primary"}
        onChange={(id) => id && m.setCalendar.mutate(id)}
        options={(calendars.data?.calendars ?? []).map((c) => ({ value: c.id, label: c.summary + (c.primary ? " ★" : "") }))}
      />
    </div>
  );
}
