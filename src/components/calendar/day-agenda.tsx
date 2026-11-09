"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { ExternalLink } from "lucide-react";
import { formatTimeRange, type UiLocale } from "@/lib/dates";
import { CheckboxCircle } from "@/components/ui/checkbox-circle";
import { useItemActions } from "@/components/items/use-item-actions";
import { ListSkeleton } from "@/components/ui/skeleton";
import type { AgendaEntry } from "./use-calendar-data";
import { cn } from "@/lib/cn";

/** The selected day's list: timed entries (Swift + Google) first, then untimed tasks. */
export function DayAgenda({
  entries,
  locale,
  timeFormat,
  loading,
}: {
  entries: AgendaEntry[];
  locale: UiLocale;
  timeFormat: "24h" | "12h";
  loading: boolean;
}) {
  const t = useTranslations();
  const actions = useItemActions();
  if (loading && entries.length === 0) return <ListSkeleton rows={3} />;

  const timed = entries.filter((e) => e.start || (e.kind === "google" && e.event.all_day) || (e.kind === "item" && e.item.all_day));
  const untimed = entries.filter((e) => !timed.includes(e));

  if (entries.length === 0) {
    return <p className="card px-5 py-10 text-center text-muted">{t("calendar.noItems")}</p>;
  }

  const row = (e: AgendaEntry) => {
    const when = e.start ? formatTimeRange(e.start, e.end, locale, timeFormat) : t("field.allDay");
    if (e.kind === "google") {
      const content = (
        <>
          <span aria-hidden className="size-3 shrink-0 rounded-full ring-2 ring-[var(--cat-blue-chip)]" style={{ background: e.color }} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[16px] font-medium">{e.event.title}</span>
            <span className="mt-0.5 flex items-center gap-2 text-[13px] text-muted">
              <span className="tabular-nums">{when}</span>
              <span className="rounded-full bg-chip px-2 py-0.5 text-[11px] font-medium">{t("sync.fromGoogle")}</span>
            </span>
          </span>
          {e.event.html_link && <ExternalLink className="size-4 shrink-0 text-subtle" aria-hidden />}
        </>
      );
      return (
        <li key={e.key}>
          {e.event.html_link ? (
            <a href={e.event.html_link} target="_blank" rel="noreferrer" className="flex min-h-[68px] items-center gap-4 px-4 py-3">
              {content}
            </a>
          ) : (
            <div className="flex min-h-[68px] items-center gap-4 px-4 py-3">{content}</div>
          )}
        </li>
      );
    }
    const done = e.item.status === "done";
    return (
      <li key={e.key} className="flex min-h-[68px] items-center gap-4 px-4 py-3">
        {e.start ? (
          <span aria-hidden className="size-3 shrink-0 rounded-full" style={{ background: e.color }} />
        ) : (
          <CheckboxCircle checked={done} onChange={() => actions.toggleDone(e.item)} label={done ? t("action.reopen") : t("action.complete")} />
        )}
        <Link href={`/edit/${e.item.id}`} className="min-w-0 flex-1">
          <span className={cn("block truncate text-[16px] font-medium", done && "text-muted line-through")}>{e.item.title}</span>
          {e.start && <span className="mt-0.5 block text-[13px] tabular-nums text-muted">{when}</span>}
        </Link>
      </li>
    );
  };

  return (
    <div className="space-y-5">
      {timed.length > 0 && <ul className="card divide-y divide-divider overflow-hidden">{timed.map(row)}</ul>}
      {untimed.length > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-semibold text-muted">{t("calendar.untimed")}</h3>
          <ul className="card divide-y divide-divider overflow-hidden">{untimed.map(row)}</ul>
        </section>
      )}
    </div>
  );
}
