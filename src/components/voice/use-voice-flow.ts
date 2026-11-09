"use client";

import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";
import type { ParseResult } from "@/lib/ai/schema";
import { draftsFromResult, type Draft } from "@/lib/domain/drafts";
import { api, ApiError } from "@/lib/client/api";
import { useCategories } from "@/lib/client/queries";
import { useAppSettings } from "@/hooks/use-app-settings";
import { useOnline } from "@/hooks/use-online";
import { useRecorder, type Recording } from "@/hooks/use-recorder";
import { useToast } from "@/components/ui/toast";

export type VoiceLang = "auto" | "az" | "en";
type FlowState = "idle" | "processing" | "review";

interface ParseResponse extends ParseResult {
  transcript: string;
}

export interface VoiceResult {
  drafts: Draft[];
  transcript: string;
  language: "az" | "en";
  source: "voice" | "text";
}

/**
 * Voice/text → drafts. Handles recording, upload, parsing errors and empty results.
 * On an AI failure the transcript is handed back via onFallbackText so nothing is lost.
 */
export function useVoiceFlow({ lang, onFallbackText }: { lang: VoiceLang; onFallbackText: (text: string) => void }) {
  const t = useTranslations("voice");
  const toast = useToast();
  const online = useOnline();
  const categories = useCategories();
  const { today, defaultEventMinutes } = useAppSettings();
  const [state, setState] = useState<FlowState>("idle");
  const [result, setResult] = useState<VoiceResult | null>(null);

  const handle = useCallback(
    (res: ParseResponse, source: "voice" | "text") => {
      const drafts = draftsFromResult(res, { categories, defaultEventMinutes, today });
      if (drafts.length === 0) {
        setState("idle");
        if (res.transcript) onFallbackText(res.transcript);
        toast({ message: res.clarification ?? t("nothingHeard"), duration: 5000 });
        return;
      }
      setResult({ drafts, transcript: res.transcript, language: res.detected_language, source });
      setState("review");
    },
    [categories, defaultEventMinutes, today, onFallbackText, toast, t],
  );

  const fail = useCallback(
    async (err: unknown, transcript?: string) => {
      setState("idle");
      if (transcript) onFallbackText(transcript);
      const code = err instanceof ApiError ? err.code : "";
      toast({
        message: code === "rate_limited" ? t("rateLimited") : code === "network" ? t("offline") : t("error"),
        tone: "error",
        duration: 6000,
      });
    },
    [onFallbackText, toast, t],
  );

  const upload = useCallback(
    async (r: Recording) => {
      if (r.durationMs < 600) {
        setState("idle");
        return; // accidental tap
      }
      setState("processing");
      const form = new FormData();
      const ext = r.mimeType.includes("mp4") || r.mimeType.includes("aac") ? "m4a" : r.mimeType.includes("ogg") ? "ogg" : "webm";
      form.append("audio", new File([r.blob], `voice.${ext}`, { type: r.mimeType.split(";")[0] }));
      form.append("lang", lang);
      form.append("duration", String(Math.round(r.durationMs)));
      try {
        const res = await fetch("/api/voice", { method: "POST", body: form, credentials: "same-origin" });
        const body = (await res.json().catch(() => ({}))) as Partial<ParseResponse> & { error?: string };
        if (!res.ok) throw Object.assign(new ApiError(res.status, body.error ?? "server_error"), { transcript: body.transcript });
        handle(body as ParseResponse, "voice");
      } catch (err) {
        const transcript = (err as { transcript?: string }).transcript;
        fail(err instanceof TypeError ? new ApiError(0, "network") : err, transcript);
      }
    },
    [lang, handle, fail],
  );

  const recorder = useRecorder({ onComplete: upload });

  const startRecording = useCallback(() => {
    if (!online) {
      toast({ message: t("offline"), tone: "error" });
      return;
    }
    setResult(null);
    recorder.start();
  }, [online, recorder, toast, t]);

  const parseText = useCallback(
    async (text: string) => {
      if (!online) {
        toast({ message: t("offline"), tone: "error" });
        return;
      }
      setState("processing");
      try {
        handle(await api<ParseResponse>("/api/parse", { method: "POST", json: { text } }), "text");
      } catch (err) {
        fail(err, text);
      }
    },
    [online, handle, fail, toast, t],
  );

  const close = useCallback(() => {
    setResult(null);
    setState("idle");
  }, []);

  return {
    state: recorder.state === "recording" || recorder.state === "requesting" ? ("recording" as const) : state,
    recorder,
    result,
    setResult,
    startRecording,
    parseText,
    close,
    online,
  };
}
