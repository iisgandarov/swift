"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type RecorderState = "idle" | "requesting" | "recording" | "denied" | "unsupported" | "error";

const MAX_MS = 60_000;
const SILENCE_MS = 2_500;
const SILENCE_LEVEL = 0.035; // RMS below this counts as silence
const MIN_SPEECH_MS = 400; // don't auto-stop before the user has said anything

/** Safari/iOS records audio/mp4, Chrome/Android audio/webm. Pick the first one the browser supports. */
export function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4;codecs=mp4a.40.2", "audio/mp4", "audio/aac", "audio/ogg;codecs=opus"];
  return candidates.find((t) => MediaRecorder.isTypeSupported?.(t));
}

export interface Recording {
  blob: Blob;
  mimeType: string;
  durationMs: number;
}

/**
 * Microphone recording with a live level meter, 60 s cap and auto-stop after
 * 2.5 s of silence (once speech was detected). Uses wall-clock timestamps so the
 * timer stays right even if the page is throttled.
 */
export function useRecorder({ onComplete }: { onComplete: (r: Recording) => void }) {
  const [state, setState] = useState<RecorderState>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [levels, setLevels] = useState<number[]>(() => Array(24).fill(0));

  const rec = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const audioCtx = useRef<AudioContext | null>(null);
  const raf = useRef<number | null>(null);
  const chunks = useRef<Blob[]>([]);
  const startedAt = useRef(0);
  const cancelled = useRef(false);
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  const cleanup = useCallback(() => {
    if (raf.current) cancelAnimationFrame(raf.current);
    raf.current = null;
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    audioCtx.current?.close().catch(() => undefined);
    audioCtx.current = null;
  }, []);

  useEffect(() => cleanup, [cleanup]);

  const stop = useCallback(() => {
    if (rec.current && rec.current.state !== "inactive") rec.current.stop();
  }, []);

  const cancel = useCallback(() => {
    cancelled.current = true;
    stop();
    cleanup();
    setState("idle");
  }, [stop, cleanup]);

  const start = useCallback(async () => {
    if (typeof window === "undefined" || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setState("unsupported");
      return;
    }
    setState("requesting");
    cancelled.current = false;
    chunks.current = [];
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 },
      });
    } catch (err) {
      const name = err instanceof DOMException ? err.name : "";
      setState(name === "NotAllowedError" || name === "SecurityError" ? "denied" : "error");
      return;
    }

    const mimeType = pickMimeType();
    const recorder = new MediaRecorder(stream.current, mimeType ? { mimeType, audioBitsPerSecond: 48_000 } : undefined);
    rec.current = recorder;
    recorder.ondataavailable = (e) => e.data.size > 0 && chunks.current.push(e.data);
    recorder.onstop = () => {
      const durationMs = Date.now() - startedAt.current;
      cleanup();
      if (cancelled.current) return;
      const type = recorder.mimeType || mimeType || "audio/webm";
      setState("idle");
      onCompleteRef.current({ blob: new Blob(chunks.current, { type }), mimeType: type, durationMs });
    };

    // level meter + silence detection
    let lastSound = Date.now();
    let spoke = false;
    try {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      audioCtx.current = new Ctx();
      await audioCtx.current.resume().catch(() => undefined);
      const source = audioCtx.current.createMediaStreamSource(stream.current);
      const analyser = audioCtx.current.createAnalyser();
      analyser.fftSize = 1024;
      source.connect(analyser);
      const buf = new Float32Array(analyser.fftSize);
      const loop = () => {
        analyser.getFloatTimeDomainData(buf);
        let sum = 0;
        for (const v of buf) sum += v * v;
        const rms = Math.sqrt(sum / buf.length);
        const now = Date.now();
        if (rms > SILENCE_LEVEL) {
          lastSound = now;
          if (now - startedAt.current > 150) spoke = true;
        }
        setLevels((l) => [...l.slice(1), Math.min(1, rms * 6)]);
        const el = now - startedAt.current;
        setElapsed(el);
        if (el >= MAX_MS) return stop();
        if (spoke && el > MIN_SPEECH_MS && now - lastSound > SILENCE_MS) return stop();
        raf.current = requestAnimationFrame(loop);
      };
      raf.current = requestAnimationFrame(loop);
    } catch {
      // no Web Audio: still record, just without the meter; enforce the cap with a timer
      const tick = () => {
        const el = Date.now() - startedAt.current;
        setElapsed(el);
        if (el >= MAX_MS) return stop();
        raf.current = requestAnimationFrame(tick);
      };
      raf.current = requestAnimationFrame(tick);
    }

    startedAt.current = Date.now();
    setElapsed(0);
    recorder.start(250);
    setState("recording");
  }, [cleanup, stop]);

  return { state, elapsed, levels, start, stop, cancel, maxMs: MAX_MS };
}
