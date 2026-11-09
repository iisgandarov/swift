"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { NAV_ITEMS } from "@/lib/nav";
import { navigate, type TabKey } from "@/lib/client/nav";
import { cn } from "@/lib/cn";

/** Tabs highlight on pointerdown (before the click completes), then switch via the client shell. */
export function BottomNav({ active }: { active: TabKey | null }) {
  const t = useTranslations("nav");
  const [pending, setPending] = useState<TabKey | null>(null);
  const [seen, setSeen] = useState(active);
  if (seen !== active) {
    setSeen(active);
    setPending(null);
  }
  const shown = pending ?? active;
  return (
    <nav
      aria-label={t("main")}
      className="chrome fixed inset-x-0 bottom-0 z-40 border-t border-line bg-nav backdrop-blur-xl lg:hidden"
      style={{ paddingBottom: "var(--safe-bottom)" }}
    >
      <ul className="mx-auto flex h-[var(--nav-h)] max-w-xl items-stretch justify-around px-2">
        {NAV_ITEMS.map(({ key, href, icon: Icon }) => {
          const on = shown === key;
          return (
            <li key={key} className="flex flex-1">
              <a
                href={href}
                aria-current={on ? "page" : undefined}
                onPointerDown={() => setPending(key)}
                onPointerCancel={() => setPending(null)}
                onClick={(e) => {
                  e.preventDefault();
                  navigate(href);
                }}
                className={cn(
                  "flex min-h-11 flex-1 flex-col items-center justify-center gap-1 rounded-2xl text-[11px] font-medium",
                  on ? "text-accent" : "text-muted",
                )}
              >
                <Icon aria-hidden className="size-6" strokeWidth={on ? 2.2 : 1.8} />
                <span>{t(key)}</span>
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
