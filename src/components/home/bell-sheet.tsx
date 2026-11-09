"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import type { Item } from "@/lib/domain/types";
import { Sheet } from "@/components/ui/sheet";
import { isOverdue } from "@/lib/domain/rules";
import { formatShortDate, formatTimeRange } from "@/lib/dates";
import { itemTimes } from "@/lib/client/display";
import { useAppSettings } from "@/hooks/use-app-settings";

export function BellSheet({ open, onClose, items }: { open: boolean; onClose: () => void; items: Item[] }) {
  const t = useTranslations("home");
  const { today, tz, locale, timeFormat, now } = useAppSettings();
  const overdue = items.filter((i) => isOverdue(i, today));
  const nowIso = new Date(now).toISOString();
  const next = items
    .filter((i) => i.status === "open" && i.date === today && i.start_at && (i.end_at ?? i.start_at) >= nowIso)
    .sort((a, b) => a.start_at!.localeCompare(b.start_at!))
    .slice(0, 5);

  return (
    <Sheet open={open} onClose={onClose} title={t("notifications")}>
      {overdue.length === 0 && next.length === 0 && <p className="py-8 text-center text-muted">{t("bellEmpty")}</p>}
      {overdue.length > 0 && (
        <>
          <h3 className="mt-2 mb-1 text-sm font-semibold text-danger">{t("bellOverdue")}</h3>
          <ul className="divide-y divide-divider">
            {overdue.map((i) => (
              <li key={i.id}>
                <Link href={`/edit/${i.id}`} onClick={onClose} className="flex min-h-12 items-center justify-between gap-3 py-2">
                  <span className="truncate font-medium">{i.title}</span>
                  <span className="shrink-0 text-sm text-muted">{i.date && formatShortDate(i.date, locale)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
      {next.length > 0 && (
        <>
          <h3 className="mt-5 mb-1 text-sm font-semibold text-primary dark:text-secondary">{t("bellNext")}</h3>
          <ul className="divide-y divide-divider">
            {next.map((i) => {
              const tm = itemTimes(i, tz)!;
              return (
                <li key={i.id}>
                  <Link href={`/edit/${i.id}`} onClick={onClose} className="flex min-h-12 items-center justify-between gap-3 py-2">
                    <span className="truncate font-medium">{i.title}</span>
                    <span className="shrink-0 text-sm text-muted tabular-nums">{formatTimeRange(tm.start, tm.end, locale, timeFormat)}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </Sheet>
  );
}
