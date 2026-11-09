"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowLeft, Mic, MicOff, PencilLine, WifiOff } from "lucide-react";
import { useProfile, useUpdateProfile } from "@/lib/client/queries";
import { goBack, navigate } from "@/lib/client/nav";
import { setTextDraft } from "@/lib/client/draft";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { RecordingOverlay } from "@/components/voice/recording-overlay";
import { ResultReview } from "@/components/voice/result-review";
import { useVoiceFlow, type VoiceLang } from "@/components/voice/use-voice-flow";
import { FormFrame } from "./form-frame";

/** Voice task: one big mic button. Opening this screen starts listening right away. */
export function VoiceTaskScreen() {
  const t = useTranslations();
  const profile = useProfile();
  const updateProfile = useUpdateProfile();
  const [langOverride, setLangOverride] = useState<VoiceLang | null>(null);
  const lang: VoiceLang = langOverride ?? profile?.voice_locale ?? "auto";
  const [kept, setKept] = useState<string | null>(null); // transcript kept after an AI failure

  const onFallbackText = useCallback((text: string) => setKept(text), []);
  const flow = useVoiceFlow({ lang, onFallbackText });
  const { recorder } = flow;

  const started = useRef(false);
  useEffect(() => {
    if (!started.current) {
      started.current = true;
      flow.startRecording();
    }
  }, [flow]);

  const overlayMode = flow.state === "recording" ? "recording" : flow.state === "processing" ? "processing" : null;

  return (
    <FormFrame>
      <div className="flex min-h-[calc(100dvh-var(--safe-top)-var(--safe-bottom)-48px)] flex-col lg:min-h-[520px]">
        <header className="chrome mb-5 grid grid-cols-[44px_1fr_44px] items-center">
          <button type="button" onClick={() => goBack("/")} aria-label={t("newTask.back")} className="-ml-2 flex size-11 items-center justify-center rounded-full hover:bg-surface-2">
            <ArrowLeft className="size-6" aria-hidden />
          </button>
          <h1 className="text-center text-xl font-bold">{t("newTask.voiceTitle")}</h1>
        </header>

        <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
          <button
            type="button"
            onClick={() => {
              setKept(null);
              flow.startRecording();
            }}
            disabled={!flow.online}
            data-testid="voice-button"
            aria-label={t("newTask.tapToSpeak")}
            className="chrome btn-primary flex size-28 items-center justify-center rounded-full transition active:scale-95 disabled:opacity-50"
          >
            <Mic className="size-11" aria-hidden />
          </button>
          <p className="text-lg font-semibold">{t("newTask.tapToSpeak")}</p>
          <p className="max-w-xs text-muted">{t("newTask.voiceHint")}</p>
          {!flow.online && (
            <p role="status" className="flex items-center gap-2 rounded-full bg-chip px-4 py-2 text-sm">
              <WifiOff className="size-4" aria-hidden />
              {t("voice.offline")}
            </p>
          )}
          {kept && (
            <div className="card w-full max-w-md space-y-3 p-4 text-left">
              <p className="text-sm text-muted">{t("voice.transcript")}</p>
              <p>“{kept}”</p>
              <Button
                variant="secondary"
                onClick={() => {
                  setTextDraft(kept);
                  navigate("/new/text", { replace: true });
                }}
              >
                <PencilLine className="size-4" aria-hidden />
                {t("newTask.editAsText")}
              </Button>
            </div>
          )}
        </div>

        <div className="mx-auto w-full max-w-xs pt-6">
          <Segmented<VoiceLang>
            label={t("voice.language")}
            value={lang}
            options={[
              { value: "auto", label: t("voice.auto") },
              { value: "az", label: "AZ" },
              { value: "en", label: "EN" },
            ]}
            onChange={(l) => {
              setLangOverride(l);
              updateProfile.mutate({ voice_locale: l });
            }}
          />
        </div>
      </div>

      <RecordingOverlay
        mode={overlayMode}
        elapsed={recorder.elapsed}
        maxMs={recorder.maxMs}
        levels={recorder.levels}
        onStop={recorder.stop}
        onCancel={recorder.cancel}
      />
      <ResultReview
        flow={flow}
        onAgain={() => {
          flow.close();
          flow.startRecording();
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
