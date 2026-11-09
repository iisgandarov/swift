"use client";

import { useTranslations } from "next-intl";
import { Mic } from "lucide-react";
import type { VoiceLang } from "./use-voice-flow";
import { cn } from "@/lib/cn";

/** The big glowing "Səsli versiya" button from the mockup, with the AZ | EN | Auto toggle. */
export function VoiceButton({
  onClick,
  disabled,
  lang,
  onLangChange,
}: {
  onClick: () => void;
  disabled?: boolean;
  lang: VoiceLang;
  onLangChange: (l: VoiceLang) => void;
}) {
  const t = useTranslations("voice");
  return (
    <div className="space-y-3">
      <div role="radiogroup" aria-label={t("language")} className="chrome mx-auto flex w-fit rounded-full bg-surface-2 p-1 text-[13px] font-semibold">
        {(["auto", "az", "en"] as const).map((l) => (
          <button
            key={l}
            type="button"
            role="radio"
            aria-checked={lang === l}
            onClick={() => onLangChange(l)}
            className={cn("h-8 min-w-12 rounded-full px-3 transition-colors", lang === l ? "bg-primary text-white" : "text-muted")}
          >
            {l === "auto" ? t("auto") : l.toUpperCase()}
          </button>
        ))}
      </div>
      <div className="relative">
        {/* soft glow rings */}
        <div aria-hidden className="pointer-events-none absolute inset-x-6 -inset-y-3 rounded-full bg-secondary/25 blur-2xl dark:bg-secondary/35" />
        <button
          type="button"
          onClick={onClick}
          disabled={disabled}
          data-testid="voice-button"
          className="chrome brand-gradient relative flex h-16 w-full items-center justify-center gap-3 rounded-full text-[17px] font-semibold text-white shadow-[var(--shadow-float)] ring-1 ring-white/20 transition active:scale-[0.98] disabled:opacity-50"
        >
          <Bars side="left" />
          <Mic className="size-6" aria-hidden />
          {t("button")}
          <Bars side="right" />
        </button>
      </div>
    </div>
  );
}

function Bars({ side }: { side: "left" | "right" }) {
  const heights = [6, 12, 18, 10, 14];
  const list = side === "left" ? heights : [...heights].reverse();
  return (
    <span aria-hidden className={cn("flex items-center gap-[3px] opacity-60", side === "left" ? "mr-1" : "ml-1")}>
      {list.map((h, i) => (
        <span key={i} className="w-[3px] rounded-full bg-white" style={{ height: h }} />
      ))}
    </span>
  );
}
