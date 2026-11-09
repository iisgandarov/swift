import { CalendarDays, ChartColumn, Goal, House, Settings, type LucideIcon } from "lucide-react";

export type NavKey = "home" | "calendar" | "focus" | "stats" | "settings";

export const NAV_ITEMS: { key: NavKey; href: string; icon: LucideIcon }[] = [
  { key: "home", href: "/", icon: House },
  { key: "calendar", href: "/calendar", icon: CalendarDays },
  { key: "focus", href: "/focus", icon: Goal },
  { key: "stats", href: "/stats", icon: ChartColumn },
  { key: "settings", href: "/settings", icon: Settings },
];

export function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}
