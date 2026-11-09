/**
 * Pomodoro state as plain data. Time is derived from timestamps (endsAt), never
 * from counting intervals, so it stays correct across screen locks and tab throttling.
 */
export type Phase = "focus" | "break";

export interface TimerState {
  phase: Phase;
  focusMin: number;
  breakMin: number;
  itemId: string | null;
  running: boolean;
  /** epoch ms when the current phase ends (only while running) */
  endsAt: number | null;
  /** ms left when paused / not started */
  remainingMs: number;
  /** epoch ms when the current focus phase first started (for logging) */
  startedAt: number | null;
}

export function initialTimer(focusMin = 25, breakMin = 5, itemId: string | null = null): TimerState {
  return { phase: "focus", focusMin, breakMin, itemId, running: false, endsAt: null, remainingMs: focusMin * 60_000, startedAt: null };
}

export function remaining(s: TimerState, now: number) {
  return s.running && s.endsAt ? Math.max(0, s.endsAt - now) : s.remainingMs;
}

export function start(s: TimerState, now: number): TimerState {
  if (s.running) return s;
  return { ...s, running: true, endsAt: now + s.remainingMs, startedAt: s.startedAt ?? (s.phase === "focus" ? now : null) };
}

export function pause(s: TimerState, now: number): TimerState {
  if (!s.running) return s;
  return { ...s, running: false, endsAt: null, remainingMs: remaining(s, now) };
}

export function reset(s: TimerState): TimerState {
  return initialTimer(s.focusMin, s.breakMin, s.itemId);
}

/** Moves to the next phase (focus → break → focus), not running. */
export function nextPhase(s: TimerState): TimerState {
  const phase: Phase = s.phase === "focus" ? "break" : "focus";
  return {
    ...s,
    phase,
    running: false,
    endsAt: null,
    remainingMs: (phase === "focus" ? s.focusMin : s.breakMin) * 60_000,
    startedAt: null,
  };
}

/** Minutes actually spent in the current focus phase so far. */
export function focusedMinutes(s: TimerState, now: number) {
  if (s.phase !== "focus") return 0;
  return Math.round((s.focusMin * 60_000 - remaining(s, now)) / 60_000);
}
