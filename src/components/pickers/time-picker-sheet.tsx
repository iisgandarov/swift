"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { addMinutesToTime, timeToMinutes } from "@/lib/dates";

const DURATIONS = [15, 30, 45, 60, 90, 120];

export interface TimeValue {
  start: string | null;
  end: string | null;
}

/** Native time inputs (iOS wheel / Android clock) + quick duration chips. */
export function TimePickerSheet({
  open,
  onClose,
  value,
  defaultMinutes,
  onChange,
  single = false,
}: {
  open: boolean;
  onClose: () => void;
  value: TimeValue;
  defaultMinutes: number;
  onChange: (v: TimeValue) => void;
  /** one time only (a task's deadline / reminder): no end time or duration */
  single?: boolean;
}) {
  const t = useTranslations();
  const [start, setStart] = useState(value.start ?? "09:00");
  const [end, setEnd] = useState(value.end ?? addMinutesToTime(value.start ?? "09:00", defaultMinutes).time);
  // reset the draft each time the sheet opens (state adjustment during render, no effect needed)
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setStart(value.start ?? "09:00");
      setEnd(value.end ?? addMinutesToTime(value.start ?? "09:00", defaultMinutes).time);
    }
  }

  const duration = ((timeToMinutes(end) - timeToMinutes(start)) % 1440 + 1440) % 1440;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t("field.time")}
      footer={
        <div className="flex gap-3">
          <Button
            variant="secondary"
            className="flex-1"
            onClick={() => {
              onChange({ start: null, end: null });
              onClose();
            }}
          >
            {t("field.noTime")}
          </Button>
          <Button
            className="flex-1"
            onClick={() => {
              onChange({ start, end: single ? null : end });
              onClose();
            }}
          >
            {t("action.done")}
          </Button>
        </div>
      }
    >
      <div className={single ? "grid grid-cols-1 gap-3" : "grid grid-cols-2 gap-3"}>
        <label className="block">
          <span className="mb-1.5 block text-sm text-muted">{t("field.start")}</span>
          <input
            type="time"
            value={start}
            onChange={(e) => {
              const s = e.target.value;
              if (!s) return;
              setStart(s);
              setEnd(addMinutesToTime(s, duration || defaultMinutes).time); // keep the duration
            }}
            className="h-14 w-full rounded-2xl border border-line bg-surface-2 px-4 text-lg font-semibold tabular-nums"
          />
        </label>
        {!single && (
        <label className="block">
          <span className="mb-1.5 block text-sm text-muted">{t("field.end")}</span>
          <input
            type="time"
            value={end}
            onChange={(e) => e.target.value && setEnd(e.target.value)}
            className="h-14 w-full rounded-2xl border border-line bg-surface-2 px-4 text-lg font-semibold tabular-nums"
          />
        </label>
        )}
      </div>
      {!single && (
      <>
      <p className="mt-5 mb-2 text-sm text-muted">{t("field.duration")}</p>
      <div className="chrome flex flex-wrap gap-2">
        {DURATIONS.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setEnd(addMinutesToTime(start, m).time)}
            className={
              "h-10 rounded-full px-4 text-sm font-medium " + (duration === m ? "sel" : "bg-chip text-chip-fg")
            }
          >
            {m < 60 ? `${m} ${t("focus.minutes")}` : `${m / 60} ${t("field.hours")}`}
          </button>
        ))}
      </div>
      </>
      )}
    </Sheet>
  );
}
