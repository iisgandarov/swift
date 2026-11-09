"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { BottomNav } from "./bottom-nav";
import { Sidebar } from "./sidebar";
import { Fab } from "./fab";
import { OfflinePill } from "./offline-pill";
import { ReconnectBanner } from "./reconnect-banner";

const FAB_ROUTES = new Set(["/", "/calendar"]);
const FULLSCREEN_ROUTES = ["/new", "/edit"];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const fullscreen = FULLSCREEN_ROUTES.some((r) => pathname === r || pathname.startsWith(`${r}/`));

  return (
    <div className="flex min-h-dvh">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <main
          className={
            "mx-auto w-full max-w-[1200px] flex-1 px-5 pt-[calc(var(--safe-top)+12px)] lg:px-10 lg:pt-8 lg:pb-12 " +
            (fullscreen
              ? "pb-[calc(var(--safe-bottom)+24px)]"
              : "pb-[calc(var(--nav-h)+var(--safe-bottom)+96px)]")
          }
        >
          {!fullscreen && <ReconnectBanner />}
          {children}
        </main>
      </div>
      <OfflinePill />
      {!fullscreen && <BottomNav />}
      {FAB_ROUTES.has(pathname) && <Fab />}
    </div>
  );
}
