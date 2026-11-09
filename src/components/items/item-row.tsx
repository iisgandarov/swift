"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { motion, useMotionValue, useReducedMotion, useTransform, type PanInfo } from "motion/react";
import { CalendarCheck2, CalendarDays, CalendarX2, Check, EllipsisVertical, Loader2, RotateCw, Trash2 } from "lucide-react";
import type { Category, Item } from "@/lib/domain/types";
import { itemWhenLabel, PRIORITY_DOT } from "@/lib/client/display";
import { CheckboxCircle } from "@/components/ui/checkbox-circle";
import { CategoryChip } from "@/components/ui/category-chip";
import type { UiLocale } from "@/lib/dates";
import { cn } from "@/lib/cn";

const SWIPE = 96;

export interface ItemRowProps {
  item: Item;
  category: Category | undefined;
  locale: UiLocale;
  tz: string;
  timeFormat: "24h" | "12h";
  today: string;
  overdue: boolean;
  showDate: boolean;
  onToggle: (item: Item) => void;
  onDelete: (item: Item) => void;
  onMenu: (item: Item) => void;
  onRetrySync: (item: Item) => void;
}

export function ItemRow(props: ItemRowProps) {
  const { item, category, locale, overdue, onToggle, onDelete, onMenu, onRetrySync } = props;
  const t = useTranslations();
  const router = useRouter();
  const reduce = useReducedMotion();
  const x = useMotionValue(0);
  const doneOpacity = useTransform(x, [0, SWIPE], [0, 1]);
  const deleteOpacity = useTransform(x, [-SWIPE, 0], [1, 0]);
  const dragged = useRef(false);
  const done = item.status === "done";

  const when = itemWhenLabel(item, {
    locale,
    tz: props.tz,
    timeFormat: props.timeFormat,
    today: props.today,
    showDate: props.showDate,
    allDayLabel: t("field.allDay"),
  });

  return (
    <li className="relative overflow-hidden" data-testid="item-row" data-title={item.title}>
      {/* swipe backgrounds */}
      <motion.div aria-hidden style={{ opacity: doneOpacity }} className="absolute inset-0 flex items-center bg-success pl-6 text-white">
        <Check className="size-6" />
      </motion.div>
      <motion.div aria-hidden style={{ opacity: deleteOpacity }} className="absolute inset-0 flex items-center justify-end bg-danger pr-6 text-white">
        <Trash2 className="size-6" />
      </motion.div>

      <motion.div
        style={{ x }}
        drag={reduce ? false : "x"}
        dragDirectionLock
        dragSnapToOrigin
        dragElastic={0.5}
        dragConstraints={{ left: 0, right: 0 }}
        onDragStart={() => {
          dragged.current = true;
        }}
        onDragEnd={(_e, info: PanInfo) => {
          if (info.offset.x > SWIPE) onToggle(item);
          else if (info.offset.x < -SWIPE) onDelete(item);
          setTimeout(() => (dragged.current = false), 50);
        }}
        className="relative flex min-h-[76px] cursor-pointer items-center gap-4 bg-surface py-3 pr-2 pl-4"
        onClick={() => {
          if (!dragged.current) router.push(`/edit/${item.id}`);
        }}
      >
        <CheckboxCircle checked={done} onChange={() => onToggle(item)} label={done ? t("action.reopen") : t("action.complete")} />

        <div className="min-w-0 flex-1">
          <p className={cn("line-clamp-2 text-[16px] font-medium leading-snug", done && "text-muted line-through decoration-muted/70")}>
            {item.title}
          </p>
          <div className="mt-1 flex items-center justify-between gap-2">
            <div className="flex min-h-6 min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-muted">
              {(when || overdue) && (
                <span className="flex items-center gap-1.5 tabular-nums">
                  <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: PRIORITY_DOT[item.priority] }} />
                  {when && <span className={cn(done && "line-through")}>{when}</span>}
                </span>
              )}
              {overdue && (
                <span className="rounded-full bg-danger-soft px-2 py-0.5 text-[11px] font-semibold text-danger">{t("state.overdue")}</span>
              )}
              {item.type === "event" && <SyncBadge item={item} onRetry={() => onRetrySync(item)} />}
            </div>
            {category && <CategoryChip category={category} locale={locale} className="shrink-0" />}
          </div>
        </div>

        <button
          type="button"
          aria-label={t("action.more")}
          onClick={(e) => {
            e.stopPropagation();
            onMenu(item);
          }}
          className="chrome flex size-11 shrink-0 items-center justify-center rounded-full text-muted hover:bg-surface-2"
        >
          <EllipsisVertical className="size-5" aria-hidden />
        </button>
      </motion.div>
    </li>
  );
}

function SyncBadge({ item, onRetry }: { item: Item; onRetry: () => void }) {
  const t = useTranslations("sync");
  if (item.sync_status === "failed") {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onRetry();
        }}
        className="flex min-h-6 items-center gap-1 rounded-full bg-danger-soft px-2 text-[11px] font-semibold text-danger"
        title={t("failed")}
      >
        <CalendarX2 className="size-3.5" aria-hidden />
        <RotateCw className="size-3" aria-hidden />
        {t("retry")}
      </button>
    );
  }
  if (item.sync_status === "pending") {
    return <Loader2 className="size-3.5 animate-spin text-subtle" aria-label={t("pending")} />;
  }
  if (item.sync_status === "synced") {
    return <CalendarCheck2 className="size-3.5 text-primary dark:text-secondary" aria-label={t("synced")} />;
  }
  return <CalendarDays className="size-3.5 text-subtle" aria-hidden />;
}
