"use client";

import { useSyncExternalStore } from "react";

/**
 * Speed log kept on this device only (localStorage). Each AI request or save records the
 * time the user waited plus the server's stage timings (Server-Timing header), so the real
 * end-to-end speed on the phone can be read in Settings → Speed as p50 / p90.
 */
export type PerfKind = "text" | "voice" | "save";

export interface PerfEntry {
  kind: PerfKind;
  at: number;
  ok: boolean;
  /** what the user waited, from tap/stop to answer */
  totalMs: number;
  /** client and server stages in ms */
  stages: Record<string, number>;
  /** e.g. the AI model that answered */
  note?: string;
}

const KEY = "swift.perf.v1";
const MAX = 60;

export function readPerf(): PerfEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as PerfEntry[]) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

const CHANGED = "swift:perf";

export function recordPerf(entry: PerfEntry) {
  try {
    localStorage.setItem(KEY, JSON.stringify([...readPerf(), entry].slice(-MAX)));
    window.dispatchEvent(new Event(CHANGED));
  } catch {
    /* storage unavailable: the log is optional */
  }
}

export function clearPerf() {
  try {
    localStorage.removeItem(KEY);
    window.dispatchEvent(new Event(CHANGED));
  } catch {
    /* ignore */
  }
}

const EMPTY: PerfEntry[] = [];
let cached: { raw: string | null; list: PerfEntry[] } = { raw: null, list: EMPTY };

function snapshot(): PerfEntry[] {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    return EMPTY;
  }
  if (raw !== cached.raw) cached = { raw, list: readPerf() };
  return cached.list;
}

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGED, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGED, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** The speed log, live-updating; empty during server rendering. */
export function usePerfLog(): PerfEntry[] {
  return useSyncExternalStore(subscribe, snapshot, () => EMPTY);
}

/** Parses a Server-Timing header into { stage: ms } and the AI model notes. */
export function parseServerTiming(header: string | null): { stages: Record<string, number>; models: string[] } {
  const stages: Record<string, number> = {};
  const models: string[] = [];
  for (const part of (header ?? "").split(",")) {
    const [name, ...params] = part.trim().split(";");
    if (!name) continue;
    const dur = params.find((p) => p.trim().startsWith("dur="));
    if (dur) stages[name.trim()] = Number(dur.trim().slice(4)) || 0;
    const desc = params.find((p) => p.trim().startsWith("desc="));
    if (desc && /^ai_\d+$/.test(name.trim())) models.push(desc.trim().slice(5).replace(/^"|"$/g, ""));
  }
  return { stages, models };
}

/** Nearest-rank percentile (p in 0..100). */
export function percentile(values: number[], p: number) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.ceil((p / 100) * sorted.length);
  return sorted[Math.min(sorted.length, Math.max(1, rank)) - 1];
}

export interface StageSummary {
  stage: string;
  p50: number;
  p90: number;
  n: number;
}

/** p50/p90 per stage for one kind, "wait" (what the user felt) first. */
export function summarize(entries: PerfEntry[], kind: PerfKind): { count: number; rows: StageSummary[] } {
  const list = entries.filter((e) => e.kind === kind && e.ok);
  const byStage = new Map<string, number[]>([["wait", list.map((e) => e.totalMs)]]);
  for (const e of list) {
    for (const [stage, ms] of Object.entries(e.stages)) {
      if (!byStage.has(stage)) byStage.set(stage, []);
      byStage.get(stage)!.push(ms);
    }
  }
  const rows = [...byStage.entries()]
    .filter(([, v]) => v.length > 0)
    .map(([stage, v]) => ({ stage, p50: percentile(v, 50), p90: percentile(v, 90), n: v.length }));
  return { count: list.length, rows };
}

/** Times a client-side step. */
export async function timed<T>(stages: Record<string, number>, name: string, work: () => Promise<T>): Promise<T> {
  const t0 = performance.now();
  try {
    return await work();
  } finally {
    stages[name] = Math.round(performance.now() - t0);
  }
}
