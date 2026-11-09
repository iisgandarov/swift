"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { screenFor, TAB_PATH, TABS, type TabKey } from "@/lib/client/nav";
import { HomeScreen } from "@/components/home/home-screen";
import { DesktopCalendarPanel } from "@/components/home/desktop-calendar-panel";
import { CalendarScreen } from "@/components/calendar/calendar-screen";
import { FocusLoader } from "@/components/focus/focus-loader";
import { StatsScreen } from "@/components/stats/stats-screen";
import { SettingsScreen } from "@/components/settings/settings-screen";
import { NewTaskScreen } from "@/components/new-task/new-task-screen";
import { EditScreen } from "@/components/new-task/edit-screen";
import { BottomNav } from "./bottom-nav";
import { Sidebar } from "./sidebar";
import { Fab } from "./fab";
import { OfflinePill } from "./offline-pill";
import { ReconnectBanner } from "./reconnect-banner";
import { ProfileSync } from "./profile-sync";

const TAB_SCREENS: Record<TabKey, () => ReactNode> = {
  home: () => <HomeScreen aside={<DesktopCalendarPanel />} />,
  calendar: () => <CalendarScreen />,
  focus: () => <FocusLoader />,
  stats: () => <StatsScreen />,
  settings: () => <SettingsScreen />,
};

/**
 * The whole app is one client shell. Route files only exist so deep links and reloads
 * work; the screen is chosen here from the URL. Tab screens stay mounted once shown
 * (and all of them are mounted shortly after the first paint), so switching tabs is a
 * visibility toggle — no server request, no remount, no lost scroll position.
 */
export function AppShell(_props: { children?: ReactNode }) {
  const pathname = usePathname();
  const search = useSearchParams();
  const screen = screenFor(pathname, new URLSearchParams(search.toString()));
  const activeTab: TabKey | null = screen.kind === "tab" ? screen.tab : null;
  const fullscreen = screen.kind !== "tab";

  // keep-alive: tabs mount on first visit, the rest right after the first paint
  const [mounted, setMounted] = useState<Set<TabKey>>(() => new Set(activeTab ? [activeTab] : ["home"]));
  if (activeTab && !mounted.has(activeTab)) setMounted(new Set([...mounted, activeTab]));
  useEffect(() => {
    const ric = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 300));
    const id = ric(() => setMounted(new Set(TABS)));
    return () => (window.cancelIdleCallback ?? window.clearTimeout)(id as number);
  }, []);

  // remember each tab's scroll position
  const scrolls = useRef<Partial<Record<string, number>>>({});
  const prevKey = useRef<string>(pathname);
  useLayoutEffect(() => {
    if (prevKey.current !== pathname) {
      window.scrollTo({ top: scrolls.current[pathname] ?? 0 });
      prevKey.current = pathname;
    }
    const onScroll = () => {
      scrolls.current[pathname] = window.scrollY;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [pathname]);

  return (
    <div className="flex min-h-dvh">
      <Sidebar active={activeTab} />
      <div className="flex min-w-0 flex-1 flex-col">
        <main
          className={
            "mx-auto w-full max-w-[1200px] flex-1 px-5 pt-[calc(var(--safe-top)+12px)] lg:px-10 lg:pt-8 lg:pb-12 " +
            (fullscreen ? "pb-[calc(var(--safe-bottom)+24px)]" : "pb-[calc(var(--nav-h)+var(--safe-bottom)+96px)]")
          }
        >
          {!fullscreen && <ReconnectBanner />}
          {TABS.filter((t) => mounted.has(t)).map((t) => (
            <section key={t} data-screen={TAB_PATH[t]} hidden={activeTab !== t}>
              {TAB_SCREENS[t]()}
            </section>
          ))}
          {screen.kind === "new" && (
            <section data-screen={pathname} key={`new-${screen.mode}`}>
              <NewTaskScreen startVoice={screen.mode === "voice"} />
            </section>
          )}
          {screen.kind === "edit" && (
            <section data-screen={pathname} key={`edit-${screen.id}`}>
              <EditScreen id={screen.id} makeEvent={screen.makeEvent} />
            </section>
          )}
        </main>
      </div>
      <ProfileSync />
      <OfflinePill />
      {!fullscreen && <BottomNav active={activeTab} />}
      {(activeTab === "home" || activeTab === "calendar") && <Fab />}
    </div>
  );
}
