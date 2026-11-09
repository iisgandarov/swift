import { CalendarDays, ChartColumn, Goal, House, Settings, type LucideIcon } from "lucide-react";

import type { TabKey } from "@/lib/client/nav";

export type NavKey = TabKey;

export const NAV_ITEMS: { key: NavKey; href: string; icon: LucideIcon }[] = [
  { key: "home", href: "/", icon: House },
  { key: "calendar", href: "/calendar", icon: CalendarDays },
  { key: "focus", href: "/focus", icon: Goal },
  { key: "stats", href: "/stats", icon: ChartColumn },
  { key: "settings", href: "/settings", icon: Settings },
];

