"use client";

import { WifiOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { AnimatePresence, motion } from "motion/react";
import { useOnline } from "@/hooks/use-online";

export function OfflinePill() {
  const online = useOnline();
  const t = useTranslations("state");
  return (
    <AnimatePresence>
      {!online && (
        <motion.div
          role="status"
          initial={{ y: -24, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -24, opacity: 0 }}
          className="chrome pointer-events-none fixed left-1/2 z-50 -translate-x-1/2"
          style={{ top: "calc(var(--safe-top) + 8px)" }}
        >
          <span className="flex items-center gap-1.5 rounded-full bg-fg px-3 py-1.5 text-xs font-semibold text-bg shadow-lg">
            <WifiOff className="size-3.5" aria-hidden />
            {t("offline")}
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
