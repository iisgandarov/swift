"use client";

import { useCallback, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { ParseResult } from "@/lib/ai/schema";
import { mockParse } from "@/lib/ai/mock";
import { draftsFromResult, withType, type Draft } from "@/lib/domain/drafts";
import type { ItemType } from "@/lib/domain/types";
import { toWav16k } from "@/lib/client/wav";
import { api, ApiError } from "@/lib/client/api";
import { useCategories } from "@/lib/client/queries";
import { useAppSettings } from "@/hooks/use-app-settings";
import { useOnline } from "@/hooks/use-online";
import { useRecorder, type Recording } from "@/hooks/use-recorder";
import { useToast } from "@/components/ui/toast";

const CLIENT_TIMEOUT_MS = 65_000;

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
  /** an instant on-device draft is shown while the AI works; saving waits for the AI */
  refining?: boolean;
}

/**
 * Voice/text → drafts. Handles recording, upload, parsing errors and empty results.
 * On an AI failure the transcript is handed back via onFallbackText so nothing is lost.
 */
export function useVoiceFlow({
  lang,
  type,
  onFallbackText,
}: {
  lang: VoiceLang;
  /** Task / Event picked on the voice screen before speaking (undefined = automatic) */
  type?: ItemType;
  onFallbackText: (text: string) => void;
}) {
  const t = useTranslations("voice");
  const toast = useToast();
  const online = useOnline();
  const categories = useCategories();
  const { today, defaultEventMinutes, tz, nowTime, locale } = useAppSettings();
  const [state, setState] = useState<FlowState>("idle");
  const [result, setResult] = useState<VoiceResult | null>(null);
  // answers that arrive after the user closed the sheet or started over are ignored
  const generation = useRef(0);

  const handle = useCallback(
    (res: ParseResponse, source: "voice" | "text", transform?: (d: Draft) => Draft): boolean => {
      let drafts = draftsFromResult(res, { categories, defaultEventMinutes, today });
      if (transform) drafts = drafts.map(transform);
      if (drafts.length === 0) {
        setState("idle");
        if (res.transcript) onFallbackText(res.transcript);
        toast({ message: res.clarification ?? t("nothingHeard"), duration: 5000 });
        return false;
      }
      setResult({ drafts, transcript: res.transcript, language: res.detected_language, source });
      setState("review");
      return true;
    },
    [categories, defaultEventMinutes, today, onFallbackText, toast, t],
  );

  const fail = useCallback(
    async (err: unknown, transcript?: string) => {
      setState("idle");
      if (transcript) onFallbackText(transcript);
      // a 504 from the platform means the server ran out of time before answering
      const code = err instanceof ApiError ? (err.status === 504 ? "timeout" : err.code) : "";
      toast({
        message:
          code === "rate_limited"
            ? t("rateLimited")
            : code === "ai_quota"
              ? t("quota")
              : code === "ai_timeout" || code === "timeout"
                ? t("timeout")
                : code === "ai_not_configured"
                ? t("notConfigured")
                : code === "network"
                  ? t("offline")
                  : t("error"),
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
      // 16 kHz mono WAV: small, and accepted by every speech model; fall back to the raw recording
      const wav = await toWav16k(r.blob);
      if (wav) {
        form.append("audio", new File([wav], "voice.wav", { type: "audio/wav" }));
      } else {
        const ext = r.mimeType.includes("mp4") || r.mimeType.includes("aac") ? "m4a" : r.mimeType.includes("ogg") ? "ogg" : "webm";
        form.append("audio", new File([r.blob], `voice.${ext}`, { type: r.mimeType.split(";")[0] }));
      }
      form.append("lang", lang);
      if (type) form.append("type", type);
      form.append("duration", String(Math.round(r.durationMs)));
      try {
        // the server gives up after ~50 s; don't leave "Understanding..." spinning longer than that
        const res = await fetch("/api/voice", { method: "POST", body: form, credentials: "same-origin", signal: AbortSignal.timeout(CLIENT_TIMEOUT_MS) });
        const body = (await res.json().catch(() => ({}))) as Partial<ParseResponse> & { error?: string };
        if (!res.ok) throw Object.assign(new ApiError(res.status, body.error ?? "server_error"), { transcript: body.transcript });
        handle(body as ParseResponse, "voice", type ? (d) => withType(d, type) : undefined);
      } catch (err) {
        const transcript = (err as { transcript?: string }).transcript;
        const name = err instanceof Error ? err.name : "";
        fail(name === "TimeoutError" || name === "AbortError" ? new ApiError(0, "timeout") : err instanceof TypeError ? new ApiError(0, "network") : err, transcript);
      }
    },
    [lang, type, handle, fail],
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

  /**
   * Resolves true when the confirmation sheet opened; `transform` applies the user's manual choices.
   * The sheet opens at once with a quick on-device draft (marked "refining", not saveable yet);
   * the AI's answer replaces it a moment later. If the AI fails, the draft stays for review.
   */
  const parseText = useCallback(
    async (text: string, transform?: (d: Draft) => Draft, preferredType?: ItemType): Promise<boolean> => {
      if (!online) {
        toast({ message: t("offline"), tone: "error" });
        return false;
      }
      const gen = ++generation.current;
      let preview: VoiceResult | null = null;
      try {
        const local = mockParse(text, {
          now: new Date().toISOString(), timezone: tz, localDate: today, localTime: nowTime,
          weekday: "", uiLocale: locale, categories: categories.flatMap((c) => [c.name_az, c.name_en]), defaultEventMinutes, preferredType,
        });
        let drafts = draftsFromResult(local, { categories, defaultEventMinutes, today });
        if (transform) drafts = drafts.map(transform);
        if (drafts.length) preview = { drafts, transcript: text, language: local.detected_language, source: "text", refining: true };
      } catch {
        /* the instant draft is a nicety; the AI answer still comes */
      }
      if (preview) {
        setResult(preview);
        setState("review");
      } else {
        setState("processing");
      }
      try {
        const body = await api<ParseResponse>("/api/parse", { method: "POST", json: { text, type: preferredType }, timeoutMs: CLIENT_TIMEOUT_MS });
        if (gen !== generation.current) return false;
        if (preview && draftsFromResult(body, { categories, defaultEventMinutes, today }).length === 0) {
          // the AI found nothing actionable but the draft did: keep the draft for review
          setResult({ ...preview, refining: false });
          if (body.clarification) toast({ message: body.clarification, duration: 5000 });
          return true;
        }
        return handle(body, "text", transform);
      } catch (err) {
        if (gen !== generation.current) return false;
        if (preview) {
          setResult({ ...preview, refining: false });
          toast({ message: t("refineFailed"), duration: 6000 });
          return true;
        }
        fail(err, text);
        return false;
      }
    },
    [online, handle, fail, toast, t, tz, today, nowTime, locale, categories, defaultEventMinutes],
  );

  const close = useCallback(() => {
    generation.current++;
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
