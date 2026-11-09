"use client";

import { useCallback, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Sparkles } from "lucide-react";
import { useProfile } from "@/lib/client/queries";
import { takeTextDraft } from "@/lib/client/draft";
import { ResultReview } from "@/components/voice/result-review";
import { useVoiceFlow } from "@/components/voice/use-voice-flow";
import { emptyForm, ItemForm, type FormState } from "./item-form";
import { FormFrame } from "./form-frame";

/** Text task: type a sentence (or use the keyboard's dictation) and/or fill in the form. */
export function TextTaskScreen() {
  const t = useTranslations();
  const profile = useProfile();
  const [initial] = useState<FormState>(() => ({ ...emptyForm(), title: takeTextDraft() ?? "" }));
  const setFormRef = useRef<((f: Partial<FormState>) => void) | null>(null);
  const onFallbackText = useCallback((text: string) => setFormRef.current?.({ title: text }), []);
  const flow = useVoiceFlow({ lang: profile?.voice_locale ?? "auto", onFallbackText });

  return (
    <FormFrame>
      <ItemForm
        initial={initial}
        heading={t("newTask.textTitle")}
        titleSlot={({ form, setForm }) => {
          setFormRef.current = setForm;
          const words = form.title.trim().split(/\s+/).filter(Boolean).length;
          if (words < 3) return null;
          return (
            <button
              type="button"
              onClick={() => flow.parseText(form.title.trim())}
              disabled={flow.state === "processing"}
              aria-label={t("newTask.understand")}
              title={t("newTask.understand")}
              data-testid="parse-text"
              className="absolute top-3 right-3 flex size-10 items-center justify-center rounded-full bg-chip text-accent"
            >
              {flow.state === "processing" ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <Sparkles className="size-5" aria-hidden />}
            </button>
          );
        }}
      />
      <ResultReview flow={flow} onAgain={flow.close} />
    </FormFrame>
  );
}
