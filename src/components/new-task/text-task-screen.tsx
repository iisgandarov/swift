"use client";

import { useCallback, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useProfile } from "@/lib/client/queries";
import { takeTextDraft } from "@/lib/client/draft";
import { applyManualChoices } from "@/lib/domain/drafts";
import { useToast } from "@/components/ui/toast";
import { ResultReview } from "@/components/voice/result-review";
import { useVoiceFlow } from "@/components/voice/use-voice-flow";
import { emptyForm, ItemForm, type FormState } from "./item-form";
import { FormFrame } from "./form-frame";

/**
 * Text task: type a sentence (or use the keyboard's dictation) and tap Create.
 * Online, the text goes to the AI first and the confirmation sheet opens with the
 * fields filled in; anything set by hand in the form wins. If the AI fails, the text
 * stays and the next tap saves it as typed. Offline, it is saved as typed right away.
 */
export function TextTaskScreen() {
  const t = useTranslations();
  const toast = useToast();
  const profile = useProfile();
  const [initial] = useState<FormState>(() => ({ ...emptyForm(), title: takeTextDraft() ?? "" }));
  const setFormRef = useRef<((f: Partial<FormState>) => void) | null>(null);
  const onFallbackText = useCallback((text: string) => setFormRef.current?.({ title: text }), []);
  const flow = useVoiceFlow({ lang: profile?.voice_locale ?? "auto", onFallbackText });
  const [saveAsTypedFor, setSaveAsTypedFor] = useState<string | null>(null);

  return (
    <FormFrame>
      <ItemForm
        initial={initial}
        heading={t("newTask.textTitle")}
        pending={flow.state === "processing"}
        titleSlot={({ setForm }) => {
          setFormRef.current = setForm;
          return null;
        }}
        onBeforeSubmit={async (form, touched) => {
          const text = form.title.trim();
          if (!flow.online || saveAsTypedFor === text) return false; // save as typed
          // a type picked by hand is sent to the AI too, so it returns that type for every item
          const opened = await flow.parseText(text, (d) => applyManualChoices(d, { ...form, touched }), touched.has("type") ? form.type : undefined);
          if (!opened) {
            setSaveAsTypedFor(text);
            toast({ message: t("newTask.saveAsTyped"), duration: 6000 });
          }
          return true;
        }}
      />
      <ResultReview flow={flow} onAgain={flow.close} />
    </FormFrame>
  );
}
