"use client";

import { useRef } from "react";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { tick } from "@/lib/haptics";
import { navigate } from "@/lib/client/nav";

const LONG_PRESS_MS = 450;

/** Floating + button: tap → New Task, long-press → New Task with voice recording started. */
export function Fab() {
  const t = useTranslations("nav");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressed = useRef(false);

  const clear = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };

  return (
    <button
      type="button"
      aria-label={t("newTask")}
      className="chrome fab fixed right-5 z-40 flex size-14 items-center justify-center rounded-full transition-transform duration-200 active:scale-95 lg:hidden"
      style={{ bottom: "calc(var(--nav-h) + var(--safe-bottom) + 16px)" }}
      onContextMenu={(e) => e.preventDefault()}
      onPointerDown={() => {
        longPressed.current = false;
        clear();
        timer.current = setTimeout(() => {
          longPressed.current = true;
          tick(15);
          navigate("/new/voice");
        }, LONG_PRESS_MS);
      }}
      onPointerUp={clear}
      onPointerLeave={clear}
      onPointerCancel={clear}
      onClick={() => {
        if (longPressed.current) return;
        navigate("/new/text");
      }}
    >
      <Plus className="size-7" strokeWidth={2} aria-hidden />
    </button>
  );
}
