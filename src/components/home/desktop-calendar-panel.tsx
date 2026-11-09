"use client";

import dynamic from "next/dynamic";
import { useSyncExternalStore } from "react";

const CalendarScreen = dynamic(() => import("@/components/calendar/calendar-screen").then((m) => m.CalendarScreen), {
  ssr: false,
});

const MQ = "(min-width: 1024px)";
function subscribe(cb: () => void) {
  const mq = window.matchMedia(MQ);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

/** The Home side calendar exists only on desktop; phones never download or fetch for it. */
export function DesktopCalendarPanel() {
  const desktop = useSyncExternalStore(subscribe, () => window.matchMedia(MQ).matches, () => false);
  if (!desktop) return null;
  return (
    <div className="card sticky top-8 p-5">
      <CalendarScreen compact />
    </div>
  );
}
