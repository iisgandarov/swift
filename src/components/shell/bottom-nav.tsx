"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { NAV_ITEMS, isActive } from "@/lib/nav";
import { cn } from "@/lib/cn";

export function BottomNav() {
  const pathname = usePathname();
  const t = useTranslations("nav");
  return (
    <nav
      aria-label={t("main")}
      className="chrome fixed inset-x-0 bottom-0 z-40 border-t border-line bg-nav backdrop-blur-xl lg:hidden"
      style={{ paddingBottom: "var(--safe-bottom)" }}
    >
      <ul className="mx-auto flex h-[var(--nav-h)] max-w-xl items-stretch justify-around px-2">
        {NAV_ITEMS.map(({ key, href, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <li key={key} className="flex flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-11 flex-1 flex-col items-center justify-center gap-1 rounded-2xl text-[11px] font-medium transition-colors duration-200",
                  active ? "text-primary dark:text-secondary" : "text-muted hover:text-fg",
                )}
              >
                <Icon
                  aria-hidden
                  className="size-6"
                  strokeWidth={active ? 2.2 : 1.8}
                  fill={active && key === "home" ? "currentColor" : "none"}
                  fillOpacity={active ? 0.18 : 0}
                />
                <span>{t(key)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
