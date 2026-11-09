"use client";

import { useEffect, useId, useRef, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useDragControls, useReducedMotion, type PanInfo } from "motion/react";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  /** Hide the visual title row but keep it for screen readers. */
  hideTitle?: boolean;
}

/**
 * Bottom sheet on phones, centered dialog on desktop. Drag down to dismiss,
 * Escape to close, focus moves into the sheet and back to the trigger on close.
 */
export function Sheet({ open, onClose, title, children, footer, className, hideTitle }: SheetProps) {
  const t = useTranslations("action");
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const drag = useDragControls();
  const startDrag = (e: ReactPointerEvent) => {
    if (!reduce) drag.start(e);
  };

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab" && panel.current) {
        const f = panel.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), textarea, select, [tabindex]:not([tabindex="-1"])',
        );
        if (f.length === 0) return;
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    requestAnimationFrame(() => panel.current?.focus());
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, [open, onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center lg:items-center">
          <motion.div
            className="absolute inset-0 bg-overlay backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            aria-hidden
          />
          <motion.div
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? titleId : undefined}
            tabIndex={-1}
            className={cn(
              "relative z-10 flex max-h-[88dvh] w-full flex-col rounded-t-[var(--radius-sheet)] border border-line bg-surface outline-none",
              "lg:max-w-lg lg:rounded-[var(--radius-sheet)] lg:shadow-2xl",
              className,
            )}
            initial={reduce ? { opacity: 0 } : { y: "100%" }}
            animate={reduce ? { opacity: 1 } : { y: 0 }}
            exit={reduce ? { opacity: 0 } : { y: "100%" }}
            transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
            drag={reduce ? false : "y"}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            dragListener={false}
            dragControls={drag}
            onDragEnd={(_e, info: PanInfo) => {
              if (info.offset.y > 120 || info.velocity.y > 600) onClose();
            }}
          >
            <div className="chrome flex touch-none justify-center pt-2.5 pb-1 lg:hidden" aria-hidden onPointerDown={startDrag}>
              <span className="h-1.5 w-10 rounded-full bg-subtle/40" />
            </div>
            {title && (
              <div
                className={cn("chrome flex touch-none items-center justify-between gap-3 px-5 pt-2 pb-2", hideTitle && "sr-only")}
                onPointerDown={startDrag}
              >
                <h2 id={titleId} className="text-lg font-bold">
                  {title}
                </h2>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label={t("close")}
                  className="flex size-10 items-center justify-center rounded-full text-muted hover:bg-surface-2"
                >
                  <X className="size-5" aria-hidden />
                </button>
              </div>
            )}
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-4">
              {children}
            </div>
            {footer && <div className="border-t border-divider px-5 pt-3 pb-[calc(var(--safe-bottom)+16px)]">{footer}</div>}
            {!footer && <div className="pb-[calc(var(--safe-bottom)+8px)]" />}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
