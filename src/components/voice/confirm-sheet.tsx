"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { AlertCircle, CalendarDays, Clock3, Flag, Folder, Loader2, RotateCcw, X } from "lucide-react";
import type { Draft, UncertainField } from "@/lib/domain/drafts";
import { draftIsValid } from "@/lib/domain/drafts";
import type { Priority } from "@/lib/domain/types";
import { addMinutesToTime, formatDayLabel, formatTimeRange } from "@/lib/dates";
import { categoryName, categoryStyle, PRIORITY_DOT } from "@/lib/client/display";
import { useCategories } from "@/lib/client/queries";
import { useAppSettings } from "@/hooks/use-app-settings";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { DatePickerSheet } from "@/components/pickers/date-picker-sheet";
import { TimePickerSheet } from "@/components/pickers/time-picker-sheet";
import { OptionSheet } from "@/components/pickers/option-sheet";
import { cn } from "@/lib/cn";

type PickerKind = "date" | "time" | "category" | "priority";

/** One editable card per parsed item: fix anything before saving. */
export function ConfirmSheet({
  open,
  drafts,
  transcript,
  busy,
  refining = false,
  onChange,
  onCreate,
  onRecordAgain,
  onClose,
  againLabel,
}: {
  open: boolean;
  drafts: Draft[];
  transcript: string;
  busy: boolean;
  /** an instant draft is shown while the AI works: visible, not yet editable or saveable */
  refining?: boolean;
  onChange: (drafts: Draft[]) => void;
  onCreate: () => void;
  onRecordAgain: () => void;
  onClose: () => void;
  /** label for the "again" button (default: Record again) */
  againLabel?: string;
}) {
  const t = useTranslations();
  const { locale, today, timeFormat, defaultEventMinutes } = useAppSettings();
  const categories = useCategories();
  const [picker, setPicker] = useState<{ kind: PickerKind; key: string } | null>(null);
  const active = drafts.find((d) => d.key === picker?.key);

  const update = (key: string, patch: Partial<Draft>) =>
    onChange(drafts.map((d) => (d.key === key ? { ...d, ...patch, uncertain: d.uncertain.filter((f) => !touched(patch).includes(f)) } : d)));

  const allValid = drafts.length > 0 && drafts.every(draftIsValid);

  return (
    <>
      <Sheet
        open={open}
        onClose={onClose}
        title={t("voice.confirmTitle")}
        footer={
          <div className="flex gap-3">
            <Button variant="secondary" onClick={onRecordAgain} className="shrink-0" data-testid="record-again">
              <RotateCcw className="size-4" aria-hidden />
              {againLabel ?? t("voice.recordAgain")}
            </Button>
            <Button className="flex-1" onClick={onCreate} disabled={!allValid || busy || refining} data-testid="create-all">
              {refining ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  {t("voice.refining")}
                </>
              ) : drafts.length > 1 ? (
                t("voice.createAll")
              ) : (
                t("action.create")
              )}
            </Button>
          </div>
        }
      >
        {transcript && (
          <p className="mb-4 text-[13px] leading-relaxed text-muted">
            <span className="font-medium">{t("voice.transcript")}:</span> “{transcript}”
          </p>
        )}
        <ul
          className={cn("space-y-3 transition-opacity", refining && "pointer-events-none opacity-60")}
          aria-busy={refining}
          data-testid="draft-list"
          data-refining={refining ? "true" : undefined}
        >
          {drafts.map((d) => (
            <li key={d.key} data-testid="draft-card" className="rounded-[20px] border border-line bg-surface-2 p-4">
              <div className="flex items-start gap-2">
                <input
                  aria-label={t("newTask.placeholder")}
                  value={d.title}
                  onChange={(e) => update(d.key, { title: e.target.value })}
                  className={cn(
                    "min-w-0 flex-1 rounded-xl bg-transparent px-1 py-1 text-[17px] font-semibold focus:bg-surface focus:outline-none",
                    d.uncertain.includes("title") && "ring-2 ring-warning",
                  )}
                />
                <button
                  type="button"
                  aria-label={t("voice.remove")}
                  onClick={() => onChange(drafts.filter((x) => x.key !== d.key))}
                  className="-mt-1 -mr-2 flex size-10 shrink-0 items-center justify-center rounded-full text-muted hover:bg-surface"
                >
                  <X className="size-5" aria-hidden />
                </button>
              </div>

              {d.clarification && (
                <p className="mt-2 flex items-start gap-2 rounded-xl bg-[var(--cat-amber-chip)] px-3 py-2 text-[13px] text-[var(--cat-amber-text)]">
                  <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
                  {d.clarification}
                </p>
              )}

              <div role="radiogroup" aria-label={t("field.type")} className={cn("mt-3 inline-grid grid-cols-2 rounded-full bg-surface p-1", d.uncertain.includes("type") && "ring-2 ring-warning")}>
                {(["task", "event"] as const).map((ty) => (
                  <button
                    key={ty}
                    type="button"
                    role="radio"
                    aria-checked={d.type === ty}
                    onClick={() => {
                      if (ty === "event" && !d.start) {
                        update(d.key, { type: "event", date: d.date ?? today });
                        setPicker({ kind: "time", key: d.key });
                      } else update(d.key, { type: ty });
                    }}
                    className={cn("h-8 rounded-full px-4 text-[13px] font-semibold", d.type === ty ? "sel" : "text-muted")}
                  >
                    {t(`type.${ty}`)}
                  </button>
                ))}
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <Pill
                  icon={<CalendarDays className="size-4" />}
                  warn={d.uncertain.includes("date")}
                  onClick={() => setPicker({ kind: "date", key: d.key })}
                  label={d.date ? formatDayLabel(d.date, locale) : t("field.date")}
                />
                <Pill
                  icon={<Clock3 className="size-4" />}
                  warn={d.uncertain.includes("time") || (d.type === "event" && !d.start)}
                  onClick={() => setPicker({ kind: "time", key: d.key })}
                  label={d.type === "event" && d.start ? formatTimeRange(d.start, d.end, locale, timeFormat) : t("field.noTime")}
                />
                <Pill
                  icon={
                    (() => {
                      const c = categories.find((x) => x.id === d.categoryId);
                      return c ? <span className="size-2.5 rounded-full" style={{ background: categoryStyle(c.color).dot }} /> : <Folder className="size-4" />;
                    })()
                  }
                  warn={d.uncertain.includes("category")}
                  onClick={() => setPicker({ kind: "category", key: d.key })}
                  label={(() => {
                    const c = categories.find((x) => x.id === d.categoryId);
                    return c ? categoryName(c, locale) : t("field.category");
                  })()}
                />
                <Pill
                  icon={<Flag className="size-4" style={{ color: PRIORITY_DOT[d.priority] }} />}
                  warn={d.uncertain.includes("priority")}
                  onClick={() => setPicker({ kind: "priority", key: d.key })}
                  label={t(`priority.${d.priority}`)}
                />
              </div>

              <textarea
                aria-label={t("field.notes")}
                rows={1}
                value={d.notes}
                placeholder={t("field.notesPlaceholder")}
                onChange={(e) => update(d.key, { notes: e.target.value })}
                className="mt-3 block w-full resize-none rounded-xl bg-surface px-3 py-2 text-[15px] placeholder:text-subtle focus:outline-none"
              />
            </li>
          ))}
        </ul>
      </Sheet>

      <DatePickerSheet
        open={picker?.kind === "date"}
        onClose={() => setPicker(null)}
        value={active?.date ?? null}
        today={today}
        locale={locale}
        allowNone={active?.type !== "event"}
        onChange={(date) => active && update(active.key, { date })}
      />
      <TimePickerSheet
        open={picker?.kind === "time"}
        onClose={() => setPicker(null)}
        value={{ start: active?.start ?? null, end: active?.end ?? null }}
        defaultMinutes={defaultEventMinutes}
        onChange={({ start, end }) =>
          active &&
          update(
            active.key,
            start
              ? { start, end: end ?? addMinutesToTime(start, defaultEventMinutes).time, type: "event", date: active.date ?? today }
              : { start: null, end: null, type: "task" },
          )
        }
      />
      <OptionSheet
        open={picker?.kind === "category"}
        onClose={() => setPicker(null)}
        title={t("field.category")}
        value={active?.categoryId ?? null}
        onChange={(categoryId) => active && update(active.key, { categoryId })}
        options={[
          { value: null, label: t("field.none") },
          ...categories.map((c) => ({
            value: c.id,
            label: categoryName(c, locale),
            icon: <span aria-hidden className="size-3 rounded-full" style={{ background: categoryStyle(c.color).dot }} />,
          })),
        ]}
      />
      <OptionSheet<Priority>
        open={picker?.kind === "priority"}
        onClose={() => setPicker(null)}
        title={t("field.priority")}
        value={active?.priority ?? "medium"}
        onChange={(priority) => active && update(active.key, { priority })}
        options={(["high", "medium", "low"] as const).map((p) => ({
          value: p,
          label: t(`priority.${p}`),
          icon: <span aria-hidden className="size-3 rounded-full" style={{ background: PRIORITY_DOT[p] }} />,
        }))}
      />
    </>
  );
}

/** Which uncertain flags an edit resolves. */
function touched(patch: Partial<Draft>): UncertainField[] {
  const out: UncertainField[] = [];
  if (patch.title !== undefined) out.push("title");
  if (patch.date !== undefined) out.push("date");
  if (patch.start !== undefined) out.push("time", "type");
  if (patch.type !== undefined) out.push("type");
  if (patch.categoryId !== undefined) out.push("category");
  if (patch.priority !== undefined) out.push("priority");
  return out;
}

function Pill({ icon, label, onClick, warn }: { icon: React.ReactNode; label: string; onClick: () => void; warn?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-9 items-center gap-1.5 rounded-full bg-surface px-3 text-[13px] font-medium",
        warn && "ring-2 ring-warning",
      )}
    >
      <span aria-hidden className="flex items-center text-muted">
        {icon}
      </span>
      {label}
    </button>
  );
}
