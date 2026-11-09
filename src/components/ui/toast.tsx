"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";

interface ToastOptions {
  message: string;
  action?: { label: string; onClick: () => void };
  duration?: number;
  tone?: "default" | "error";
}
interface ToastState extends ToastOptions {
  id: number;
}

const ToastContext = createContext<((t: ToastOptions) => void) | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastState[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const show = useCallback(
    (opts: ToastOptions) => {
      const id = nextId.current++;
      setToasts((t) => [...t.slice(-2), { ...opts, id }]);
      setTimeout(() => dismiss(id), opts.duration ?? 4000);
    },
    [dismiss],
  );

  const value = useMemo(() => show, [show]);

  return (
    <ToastContext value={value}>
      {children}
      <div
        aria-live="polite"
        className="chrome pointer-events-none fixed inset-x-0 z-[60] flex flex-col items-center gap-2 px-4 lg:bottom-6"
        style={{ bottom: "calc(var(--nav-h) + var(--safe-bottom) + 16px)" }}
      >
        <AnimatePresence initial={false}>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ duration: 0.2 }}
              className={
                "pointer-events-auto flex min-h-12 w-full max-w-md items-center justify-between gap-3 rounded-2xl px-4 py-2.5 text-sm font-medium shadow-xl " +
                (t.tone === "error" ? "bg-danger text-white" : "bg-fg text-bg")
              }
              role={t.tone === "error" ? "alert" : "status"}
            >
              <span>{t.message}</span>
              {t.action && (
                <button
                  type="button"
                  className="min-h-9 shrink-0 rounded-full px-3 font-semibold text-secondary dark:text-primary"
                  onClick={() => {
                    t.action?.onClick();
                    dismiss(t.id);
                  }}
                >
                  {t.action.label}
                </button>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside ToastProvider");
  return ctx;
}
