"use client";

import { useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { AppLink as Link } from "@/components/shell/app-link";
import { navigate } from "@/lib/client/nav";
import { useTranslations } from "next-intl";
import { Bell, Mic, Quote } from "lucide-react";
import type { Item } from "@/lib/domain/types";
import { groupForHome, type HomeFilter, type Section } from "@/lib/domain/grouping";
import { isOverdue } from "@/lib/domain/rules";
import { formatDayLabel, greetingKey } from "@/lib/dates";
import { initials } from "@/lib/client/display";
import { useBootstrap, useCategories, useItems } from "@/lib/client/queries";
import { useAppSettings } from "@/hooks/use-app-settings";
import { quoteOfTheDay } from "@/lib/quotes";
import { ItemRow } from "@/components/items/item-row";
import { ItemMenuSheet, type MenuAction } from "@/components/items/item-menu-sheet";
import { ConfirmDeleteSheet } from "@/components/items/confirm-delete-sheet";
import { useItemActions } from "@/components/items/use-item-actions";
import { DatePickerSheet } from "@/components/pickers/date-picker-sheet";
import { ListSkeleton, Skeleton } from "@/components/ui/skeleton";
import { BellSheet } from "./bell-sheet";
import { cn } from "@/lib/cn";

const FILTERS: HomeFilter[] = ["all", "today", "upcoming", "completed"];
const FILTER_KEY = "swift_home_filter";

// remembered filter, read without an effect
const filterStore = {
  listeners: new Set<() => void>(),
  get(): HomeFilter {
    const v = typeof localStorage !== "undefined" ? localStorage.getItem(FILTER_KEY) : null;
    return FILTERS.includes(v as HomeFilter) ? (v as HomeFilter) : "all";
  },
  set(v: HomeFilter) {
    localStorage.setItem(FILTER_KEY, v);
    filterStore.listeners.forEach((l) => l());
  },
  subscribe(l: () => void) {
    filterStore.listeners.add(l);
    return () => filterStore.listeners.delete(l);
  },
};

export function HomeScreen({ aside }: { aside?: ReactNode }) {
  const t = useTranslations();
  const th = useTranslations("home");
  const { locale, tz, timeFormat, today, hour, profile } = useAppSettings();
  const boot = useBootstrap();
  const categories = useCategories();
  const { data: items, isPending } = useItems();
  const actions = useItemActions();
  const filter = useSyncExternalStore(filterStore.subscribe, filterStore.get, () => "all" as HomeFilter);

  const [menuItem, setMenuItem] = useState<Item | null>(null);
  const [dateItem, setDateItem] = useState<Item | null>(null);
  const [deleteItem, setDeleteItem] = useState<Item | null>(null);
  const [bellOpen, setBellOpen] = useState(false);

  const sections = useMemo(() => groupForHome(items ?? [], filter, today, tz), [items, filter, today, tz]);
  const catById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const overdueCount = (items ?? []).filter((i) => isOverdue(i, today)).length;
  const name = profile?.display_name || boot.data?.user.name || "";

  function onMenu(action: MenuAction, item: Item) {
    setMenuItem(null);
    if (action === "edit") navigate(`/edit/${item.id}`);
    if (action === "changeDate") setDateItem(item);
    if (action === "delete") setDeleteItem(item);
    if (action === "toggleType") {
      if (item.type === "event") actions.patch(item, { type: "task" });
      else navigate(`/edit/${item.id}?type=event`);
    }
  }

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-8">
      <div className="min-w-0">
        {/* header */}
        <header className="chrome flex items-center gap-3">
          <div
            aria-hidden
            className="avatar flex size-12 shrink-0 items-center justify-center rounded-full text-lg font-semibold"
          >
            {boot.data ? initials(name) : ""}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] text-muted">{t(`greeting.${greetingKey(hour)}`)}</p>
            {boot.data ? (
              <h1 className="truncate text-[22px] font-bold leading-tight tracking-tight">
                {name} <span aria-hidden>👋</span>
              </h1>
            ) : (
              <Skeleton className="mt-1 h-6 w-32" />
            )}
          </div>
          <button
            type="button"
            onClick={() => setBellOpen(true)}
            aria-label={t("home.notifications")}
            className="relative flex size-11 items-center justify-center rounded-full hover:bg-surface-2"
          >
            <Bell className="size-6" aria-hidden />
            {overdueCount > 0 && <span className="absolute top-2 right-2.5 size-2.5 rounded-full border-2 border-bg bg-warning" />}
          </button>
        </header>

        {/* filters */}
        <div role="tablist" aria-label={t("nav.home")} className="chrome no-scrollbar -mx-5 mt-6 flex gap-2 overflow-x-auto px-5 lg:mx-0 lg:px-0">
          {FILTERS.map((f) => (
            <button
              key={f}
              role="tab"
              type="button"
              aria-selected={filter === f}
              onClick={() => filterStore.set(f)}
              className={cn(
                "h-10 shrink-0 whitespace-nowrap rounded-full px-4 text-[15px] font-medium transition-colors duration-200",
                filter === f ? "sel font-semibold" : "bg-chip text-chip-fg hover:bg-surface-2",
              )}
            >
              {t(`filter.${f}`)}
            </button>
          ))}
        </div>

        {/* content */}
        <div className="mt-6 space-y-7">
          {isPending && !items ? (
            <div>
              <Skeleton className="mb-3 h-6 w-24" />
              <ListSkeleton />
            </div>
          ) : sections.length === 0 ? (
            filter === "all" ? (
              <EmptyState />
            ) : (
              <p className="card px-5 py-10 text-center text-muted">{t("home.emptyFilter")}</p>
            )
          ) : (
            sections.map((s) => (
              <section key={s.key} aria-labelledby={`sec-${s.key}`}>
                <div className="mb-3 flex items-baseline justify-between">
                  <h2 id={`sec-${s.key}`} className="text-xl font-bold tracking-tight">
                    {sectionTitle(s, th, locale)}
                  </h2>
                  {s.date && s.kind !== "day" && <span className="text-sm text-muted">{formatDayLabel(s.date, locale)}</span>}
                </div>
                <ul className="card divide-y divide-divider overflow-hidden">
                  {s.items.map((item) => (
                    <ItemRow
                      key={item.id}
                      item={item}
                      category={item.category_id ? catById.get(item.category_id) : undefined}
                      locale={locale}
                      tz={tz}
                      timeFormat={timeFormat}
                      today={today}
                      overdue={isOverdue(item, today)}
                      showDate={s.kind !== "day" && s.kind !== "tomorrow"}
                      onToggle={actions.toggleDone}
                      onDelete={actions.remove}
                      onMenu={setMenuItem}
                      onRetrySync={actions.retrySync}
                    />
                  ))}
                </ul>
              </section>
            ))
          )}

          <QuoteCard today={today} locale={locale} />
        </div>
      </div>

      {aside && <aside className="hidden lg:block">{aside}</aside>}

      <ItemMenuSheet item={menuItem} onClose={() => setMenuItem(null)} onAction={onMenu} />
      <DatePickerSheet
        open={dateItem !== null}
        onClose={() => setDateItem(null)}
        value={dateItem?.date ?? null}
        today={today}
        locale={locale}
        allowNone={dateItem?.type !== "event"}
        onChange={(d) => dateItem && actions.patch(dateItem, { date: d })}
      />
      <ConfirmDeleteSheet
        item={deleteItem}
        onClose={() => setDeleteItem(null)}
        onConfirm={(i) => {
          setDeleteItem(null);
          actions.remove(i);
        }}
      />
      <BellSheet open={bellOpen} onClose={() => setBellOpen(false)} items={items ?? []} />
    </div>
  );
}

function sectionTitle(s: Section, t: ReturnType<typeof useTranslations<"home">>, locale: "az" | "en") {
  switch (s.kind) {
    case "today":
      return t("today");
    case "tomorrow":
      return t("tomorrow");
    case "later":
      return t("later");
    case "noDate":
      return t("noDate");
    case "completed":
      return t("completed");
    default:
      return formatDayLabel(s.date!, locale);
  }
}

function QuoteCard({ today, locale }: { today: string; locale: "az" | "en" }) {
  const q = quoteOfTheDay(today);
  return (
    <figure className="card flex gap-3 px-5 py-4">
      <Quote className="mt-0.5 size-6 shrink-0 rotate-180 fill-current text-accent opacity-60" aria-hidden />
      <blockquote className="text-[15px] leading-relaxed text-muted">{q[locale]}</blockquote>
    </figure>
  );
}

function EmptyState() {
  const t = useTranslations("home");
  return (
    <div className="card flex flex-col items-center px-6 py-10 text-center">
      <h2 className="text-lg font-bold">{t("emptyTitle")}</h2>
      <p className="mt-2 max-w-xs text-muted">{t("emptyBody")}</p>
      <Link
        href="/new/voice"
        className="btn-primary mt-6 inline-flex h-12 items-center gap-2 rounded-full px-6 font-semibold"
      >
        <Mic className="size-5" aria-hidden />
        {t("emptyCta")}
      </Link>
    </div>
  );
}
