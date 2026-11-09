"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, MicOff, Sparkles } from "lucide-react";
import { draftToInput } from "@/lib/domain/drafts";
import { api } from "@/lib/client/api";
import { useCreateItems, useProfile, useUpdateProfile } from "@/lib/client/queries";
import { useToast } from "@/components/ui/toast";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { VoiceButton } from "@/components/voice/voice-button";
import { RecordingOverlay } from "@/components/voice/recording-overlay";
import { ConfirmSheet } from "@/components/voice/confirm-sheet";
import { useVoiceFlow, type VoiceLang, type VoiceResult } from "@/components/voice/use-voice-flow";
import { tick } from "@/lib/haptics";
import { navigate } from "@/lib/client/nav";
import { emptyForm, ItemForm, type FormState } from "./item-form";
import { FormFrame } from "./form-frame";

export function NewTaskScreen({ startVoice }: { startVoice: boolean }) {
  const t = useTranslations();
  const toast = useToast();
  const profile = useProfile();
  const updateProfile = useUpdateProfile();
  const create = useCreateItems();
  const [langOverride, setLangOverride] = useState<VoiceLang | null>(null);
  const lang: VoiceLang = langOverride ?? profile?.voice_locale ?? "auto";
  const setFormRef = useRef<((f: Partial<FormState>) => void) | null>(null);

  const onFallbackText = useCallback((text: string) => setFormRef.current?.({ title: text }), []);
  const flow = useVoiceFlow({ lang, onFallbackText });
  const { recorder } = flow;

  // FAB long-press / empty-state CTA: start listening right away
  const autoStarted = useRef(false);
  useEffect(() => {
    if (startVoice && !autoStarted.current) {
      autoStarted.current = true;
      flow.startRecording();
    }
  }, [startVoice, flow]);

  const createFrom = useCallback(
    async (result: VoiceResult) => {
      const inputs = result.drafts.map((d) =>
        draftToInput(d, { source: result.source, transcript: result.transcript, language: result.language }),
      );
      const created = await create.mutateAsync(inputs);
      tick();
      return created;
    },
    [create],
  );

  // "create without confirmation" setting: save immediately with a 5 s undo
  const autoCreate = profile?.auto_create ?? false;
  const handledResult = useRef<VoiceResult | null>(null);
  useEffect(() => {
    const result = flow.result;
    if (!autoCreate || !result || handledResult.current === result) return;
    handledResult.current = result;
    createFrom(result)
      .then((created) => {
        flow.close();
        navigate("/", { replace: true });
        toast({
          message: t("voice.created", { count: created.length }),
          duration: 5000,
          action: {
            label: t("action.undo"),
            onClick: () => created.forEach((i) => api(`/api/items/${i.id}`, { method: "DELETE" }).catch(() => undefined)),
          },
        });
      })
      .catch(() => toast({ message: t("error.generic"), tone: "error" }));
  }, [autoCreate, flow, createFrom, toast, t]);

  const overlayMode = flow.state === "recording" ? "recording" : flow.state === "processing" ? "processing" : null;

  return (
    <FormFrame>
      <ItemForm
        initial={emptyForm()}
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
              className="absolute top-3 right-3 flex size-10 items-center justify-center rounded-full bg-chip text-primary dark:text-secondary"
            >
              {flow.state === "processing" ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <Sparkles className="size-5" aria-hidden />}
            </button>
          );
        }}
        voiceSlot={() => (
          <VoiceButton
            onClick={flow.startRecording}
            disabled={!flow.online}
            lang={lang}
            onLangChange={(l) => {
              setLangOverride(l);
              updateProfile.mutate({ voice_locale: l });
            }}
          />
        )}
      />

      <RecordingOverlay
        mode={overlayMode}
        elapsed={recorder.elapsed}
        maxMs={recorder.maxMs}
        levels={recorder.levels}
        onStop={recorder.stop}
        onCancel={recorder.cancel}
      />

      <ConfirmSheet
        open={!autoCreate && flow.state === "review" && flow.result !== null}
        drafts={flow.result?.drafts ?? []}
        transcript={flow.result?.transcript ?? ""}
        busy={create.isPending}
        onChange={(drafts) => flow.result && flow.setResult({ ...flow.result, drafts })}
        onClose={flow.close}
        onRecordAgain={() => {
          flow.close();
          flow.startRecording();
        }}
        onCreate={async () => {
          if (!flow.result) return;
          try {
            const created = await createFrom(flow.result);
            flow.close();
            toast({ message: t("voice.created", { count: created.length }), duration: 3000 });
            navigate("/", { replace: true });
          } catch {
            toast({ message: t("error.generic"), tone: "error" });
          }
        }}
      />

      <Sheet
        open={recorder.state === "denied" || recorder.state === "unsupported"}
        onClose={recorder.cancel}
        title={recorder.state === "denied" ? t("voice.permissionTitle") : t("voice.unsupported")}
        footer={
          <Button className="w-full" onClick={recorder.cancel}>
            {t("action.close")}
          </Button>
        }
      >
        <div className="flex gap-3">
          <MicOff className="mt-0.5 size-6 shrink-0 text-danger" aria-hidden />
          <p className="leading-relaxed text-muted">{recorder.state === "denied" ? t("voice.permissionBody") : t("voice.unsupported")}</p>
        </div>
      </Sheet>
    </FormFrame>
  );
}
