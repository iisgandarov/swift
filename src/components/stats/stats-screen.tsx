"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CalendarDays, CheckCircle2, Flame, ListTodo, Percent, Timer } from "lucide-react";
import { computeStats } from "@/lib/domain/stats";
import { useCategories, useFocusSessions, useItems } from "@/lib/client/queries";
import { useAppSettings } from "@/hooks/use-app-settings";
import { categoryName, categoryStyle } from "@/lib/client/display";
import { weekdayShort } from "@/lib/dates";
import { PageTitle } from "@/components/ui/page-title";
import { ListSkeleton } from "@/components/ui/skeleton";

export function StatsScreen() {
  const t = useTranslations("stats");
  const tf = useTranslations("focus");
  const { today, tz, locale } = useAppSettings();
  const { data: items, isPending } = useItems();
  const sessions = useFocusSessions();
  const categories = useCategories();

  const s = useMemo(() => computeStats(items ?? [], sessions.data ?? [], today, tz), [items, sessions.data, today, tz]);
  const chart = s.last7.map((d) => ({ label: weekdayShort(d.date, locale), count: d.count, today: d.date === today }));
  const maxCat = Math.max(1, ...s.byCategory.map((c) => c.count));

  if (isPending && !items) {
    return (
      <>
        <PageTitle>{t("title")}</PageTitle>
        <ListSkeleton rows={4} />
      </>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageTitle>{t("title")}</PageTitle>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard icon={<CheckCircle2 />} label={t("completedToday")} value={s.completedToday} />
        <StatCard icon={<CalendarDays />} label={t("completedWeek")} value={s.completedThisWeek} />
        <StatCard icon={<Percent />} label={t("rate")} value={s.completionRate === null ? "—" : `${s.completionRate}%`} />
        <StatCard icon={<Flame />} label={t("streak")} value={t("streakDays", { count: s.streak })} accent />
        <StatCard icon={<Timer />} label={t("focusWeek")} value={`${s.focusMinutesThisWeek} ${tf("minutes")}`} />
        <StatCard icon={<ListTodo />} label={t("tasksVsEvents")} value={`${s.tasks} / ${s.events}`} />
      </div>

      <section className="card mt-5 p-5">
        <h2 className="mb-4 font-semibold">{t("last7")}</h2>
        <div className="h-48" role="img" aria-label={`${t("last7")}: ${s.last7.map((d) => d.count).join(", ")}`}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chart} margin={{ top: 4, right: 0, bottom: 0, left: -28 }}>
              <defs>
                <linearGradient id="bar" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" style={{ stopColor: "var(--chart-1)" }} />
                  <stop offset="1" style={{ stopColor: "var(--chart-2)" }} />
                </linearGradient>
              </defs>
              <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "var(--text-muted)", fontSize: 12 }} />
              <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: "var(--text-subtle)", fontSize: 11 }} />
              <Tooltip
                cursor={{ fill: "var(--surface-2)" }}
                contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, color: "var(--text)" }}
                labelStyle={{ color: "var(--text-muted)" }}
              />
              <Bar dataKey="count" fill="url(#bar)" radius={[8, 8, 8, 8]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="card mt-5 p-5">
        <h2 className="mb-4 font-semibold">{t("byCategory")}</h2>
        {s.byCategory.length === 0 ? (
          <p className="text-sm text-muted">—</p>
        ) : (
          <ul className="space-y-3">
            {s.byCategory.map((c) => {
              const cat = categories.find((x) => x.id === c.categoryId);
              const color = cat ? categoryStyle(cat.color).dot : "var(--cat-slate)";
              return (
                <li key={c.categoryId ?? "none"}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="font-medium">{cat ? categoryName(cat, locale) : t("noCategory")}</span>
                    <span className="tabular-nums text-muted">{c.count}</span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-surface-2">
                    <div className="h-full rounded-full" style={{ width: `${(c.count / maxCat) * 100}%`, background: color }} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function StatCard({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string | number; accent?: boolean }) {
  return (
    <div className="card p-4">
      <span aria-hidden className={"mb-3 flex size-9 items-center justify-center rounded-xl [&>svg]:size-5 " + (accent ? "bg-[var(--cat-orange-chip)] text-[var(--cat-orange-text)]" : "bg-chip text-accent")}>
        {icon}
      </span>
      <p className="text-2xl font-bold tabular-nums">{value}</p>
      <p className="mt-0.5 text-[13px] text-muted">{label}</p>
    </div>
  );
}
