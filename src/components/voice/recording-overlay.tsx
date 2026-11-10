"use client";

import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";
import { Loader2, Mic, Square, X } from "lucide-react";
import type { ReactNode } from "react";

function fmt(ms: number) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Full-screen listening / understanding state. Tap the button to stop, X to cancel. */
export function RecordingOverlay({
  mode,
  elapsed,
  maxMs,
  levels,
  onStop,
  onCancel,
  controls,
}: {
  /** shown top-left while recording, e.g. the Task / Event choice */
  controls?: ReactNode;
  mode: "recording" | "processing" | null;
  elapsed: number;
  maxMs: number;
  levels: number[];
  onStop: () => void;
  onCancel: () => void;
}) {
  const t = useTranslations("voice");
  if (typeof document === "undefined") return null;
  return createPortal(
    <AnimatePresence>
      {mode && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label={mode === "recording" ? t("listening") : t("processing")}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="chrome fixed inset-0 z-[55] flex flex-col items-center justify-between bg-bg/95 px-6 backdrop-blur-xl"
          style={{ paddingTop: "calc(var(--safe-top) + 16px)", paddingBottom: "calc(var(--safe-bottom) + 40px)" }}
        >
          <div className="flex w-full items-center justify-between gap-3">
            <div className="min-w-0">{mode === "recording" && controls}</div>
            {mode === "recording" && (
              <button
                type="button"
                onClick={onCancel}
                aria-label={t("cancel")}
                className="flex size-11 items-center justify-center rounded-full bg-surface-2 text-muted"
              >
                <X className="size-5" aria-hidden />
              </button>
            )}
          </div>

          <div className="flex flex-col items-center">
            <p className="text-2xl font-bold" aria-live="polite">
              {mode === "recording" ? t("listening") : t("processing")}
            </p>
            {mode === "recording" && (
              <p className="mt-2 tabular-nums text-muted">
                {fmt(elapsed)} / {fmt(maxMs)}
              </p>
            )}
            <div className="mt-10 flex h-20 items-center gap-[5px]" aria-hidden>
              {levels.map((l, i) => (
                <span
                  key={i}
                  className="w-[5px] rounded-full bg-accent transition-[height] duration-75"
                  style={{ height: mode === "recording" ? 8 + l * 72 : 8 + Math.abs(Math.sin(i)) * 16 }}
                />
              ))}
            </div>
          </div>

          <div className="flex flex-col items-center gap-3">
            <div className="relative">
              {mode === "recording" && (
                <motion.span
                  aria-hidden
                  className="absolute inset-0 rounded-full bg-secondary/40 dark:hidden"
                  animate={{ scale: [1, 1.35, 1], opacity: [0.6, 0, 0.6] }}
                  transition={{ duration: 1.8, repeat: Infinity }}
                />
              )}
              <button
                type="button"
                onClick={onStop}
                disabled={mode !== "recording"}
                aria-label={t("tapToStop")}
                data-testid="voice-stop"
                className="btn-primary relative flex size-24 items-center justify-center rounded-full"
              >
                {mode === "recording" ? (
                  <Square className="size-8 fill-current" aria-hidden />
                ) : (
                  <Loader2 className="size-9 animate-spin" aria-hidden />
                )}
              </button>
            </div>
            <p className="flex items-center gap-1.5 text-sm text-muted">
              {mode === "recording" ? (
                <>
                  <Mic className="size-4" aria-hidden />
                  {t("tapToStop")}
                </>
              ) : (
                " "
              )}
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
