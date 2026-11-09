"use client";

import Image from "next/image";
import { AppLink as Link } from "./app-link";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { NAV_ITEMS } from "@/lib/nav";
import type { TabKey } from "@/lib/client/nav";
import { cn } from "@/lib/cn";

export function Sidebar({ active: activeTab }: { active: TabKey | null }) {
  const t = useTranslations();
  return (
    <aside className="chrome sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-line bg-surface/60 px-4 py-6 backdrop-blur-xl lg:flex">
      <Link href="/" className="mb-8 flex items-center gap-3 px-2">
        <Image src="/icons/icon.svg" alt="" width={40} height={40} className="rounded-[11px]" priority />
        <div className="leading-tight">
          <div className="text-xl font-bold tracking-tight">Swift</div>
          <div className="text-[10px] font-medium uppercase tracking-[0.3em] text-muted">{t("app.subtitle")}</div>
        </div>
      </Link>

      <Link
        href="/new/text"
        className="btn-primary mb-6 flex h-12 items-center justify-center gap-2 rounded-full font-semibold transition-transform duration-200 active:scale-[0.98]"
      >
        <Plus className="size-5" aria-hidden />
        {t("nav.newTask")}
      </Link>

      <nav aria-label={t("nav.main")}>
        <ul className="space-y-1">
          {NAV_ITEMS.map(({ key, href, icon: Icon }) => {
            const active = activeTab === key;
            return (
              <li key={key}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex h-11 items-center gap-3 rounded-2xl px-3 text-[15px] font-medium transition-colors duration-200",
                    active ? "bg-chip text-accent" : "text-muted hover:bg-surface-2 hover:text-fg",
                  )}
                >
                  <Icon aria-hidden className="size-5" strokeWidth={active ? 2.2 : 1.8} />
                  {t(`nav.${key}`)}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="mt-auto px-2 text-xs leading-relaxed text-subtle">
        <p lang="en" className="font-semibold text-accent">{t("app.tagline")}</p>
        <p className="mt-1">{t("app.subline")}</p>
      </div>
    </aside>
  );
}
