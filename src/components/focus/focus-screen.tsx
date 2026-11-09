"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronRight, Pause, Play, RotateCcw, Target } from "lucide-react";
import * as timer from "@/lib/focus-timer";
import type { TimerState } from "@/lib/focus-timer";
import { useFocusSessions, useItems, useLogFocus } from "@/lib/client/queries";
import { useAppSettings } from "@/hooks/use-app-settings";
import { useWakeLock } from "@/hooks/use-wake-lock";
import { useItemActions } from "@/components/items/use-item-actions";
import { OptionSheet } from "@/components/pickers/option-sheet";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { PageTitle } from "@/components/ui/page-title";
import { playChime } from "@/lib/chime";
import { tick } from "@/lib/haptics";
import { utcToLocal } from "@/lib/dates";
import { cn } from "@/lib/cn";

const STORAGE = "swift_focus_timer";
const PRESETS = [
  { focus: 25, rest: 5 },
  { focus: 50, rest: 10 },
];

function load(): TimerState {
  try {
    const raw = localStorage.getItem(STORAGE);
    if (raw) return JSON.parse(raw) as TimerState;
  } catch {
    /* ignore */
  }
  return timer.initialTimer();
}

export function FocusScreen() {
  const t = useTranslations();
  const { today, tz } = useAppSettings();
  const { data: items } = useItems();
  const sessions = useFocusSessions();
  const log = useLogFocus();
  const actions = useItemActions();
  const [state, setState] = useState<TimerState>(load);
  const [now, setNow] = useState(() => Date.now());
  const [picker, setPicker] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [custom, setCustom] = useState({ focus: 30, rest: 5 });
  const [finishedItem, setFinishedItem] = useState<string | null>(null);
  const finishing = useRef(false);

  useWakeLock(state.running);

  // persist so a reload or screen lock doesn't lose the session
  useEffect(() => {
    localStorage.setItem(STORAGE, JSON.stringify(state));
  }, [state]);

  const openTasks = useMemo(
    () => (items ?? []).filter((i) => i.status === "open" && (i.date === null || i.date <= today)),
    [items, today],
  );
  const item = (items ?? []).find((i) => i.id === state.itemId);
  const left = timer.remaining(state, now);
  const total = (state.phase === "focus" ? state.focusMin : state.breakMin) * 60_000;
  const progress = 1 - left / total;

  const logSession = useCallback(
    (s: TimerState, completed: boolean, at: number) => {
      const minutes = completed ? s.focusMin : timer.focusedMinutes(s, at);
      if (s.phase !== "focus" || !s.startedAt || minutes < 1) return;
      log.mutate({
        item_id: s.itemId,
        started_at: new Date(s.startedAt).toISOString(),
        planned_minutes: s.focusMin,
        actual_minutes: minutes,
        completed,
      });
    },
    [log],
  );

  // keep the latest values for the timer callback
  const latest = useRef({ state, logSession });
  useEffect(() => {
    latest.current = { state, logSession };
  }, [state, logSession]);

  // tick while running; a finished phase is detected on every tick and when coming back from a locked screen
  useEffect(() => {
    if (!state.running) return;
    const check = () => {
      const at = Date.now();
      setNow(at);
      const { state: s, logSession: logIt } = latest.current;
      if (!s.running || timer.remaining(s, at) > 0 || finishing.current) return;
      finishing.current = true;
      playChime();
      tick(30);
      if (s.phase === "focus") {
        logIt(s, true, at);
        if (s.itemId) setFinishedItem(s.itemId);
      }
      setState(timer.nextPhase(s));
      finishing.current = false;
    };
    const id = setInterval(check, 250);
    document.addEventListener("visibilitychange", check);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", check);
    };
  }, [state.running]);

  const focusToday = (sessions.data ?? [])
    .filter((s) => utcToLocal(s.started_at, tz).date === today)
    .reduce((sum, s) => sum + s.actual_minutes, 0);

  const mm = Math.floor(left / 60_000);
  const ss = Math.floor((left % 60_000) / 1000);
  const R = 120;
  const C = 2 * Math.PI * R;

  const setPreset = (focus: number, rest: number) => setState((s) => ({ ...timer.initialTimer(focus, rest, s.itemId) }));
  const isPreset = (f: number, r: number) => state.focusMin === f && state.breakMin === r;

  return (
    <div className="mx-auto max-w-md">
      <PageTitle>{t("focus.title")}</PageTitle>

      <button type="button" onClick={() => setPicker(true)} disabled={state.running} className="card flex min-h-14 w-full items-center gap-3 px-4 text-left disabled:opacity-70">
        <Target className="size-5 shrink-0 text-accent" aria-hidden />
        <span className="min-w-0 flex-1 truncate font-medium">{item ? item.title : t("focus.freeFocus")}</span>
        <span className="text-sm text-muted">{t("focus.pickTask")}</span>
        <ChevronRight className="size-5 text-subtle" aria-hidden />
      </button>

      <div className="chrome mt-4 flex justify-center gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.focus}
            type="button"
            disabled={state.running}
            onClick={() => setPreset(p.focus, p.rest)}
            className={cn("h-10 rounded-full px-4 text-sm font-semibold disabled:opacity-60", isPreset(p.focus, p.rest) ? "sel" : "bg-chip text-chip-fg")}
          >
            {p.focus}/{p.rest}
          </button>
        ))}
        <button
          type="button"
          disabled={state.running}
          onClick={() => setCustomOpen(true)}
          className={cn(
            "h-10 rounded-full px-4 text-sm font-semibold disabled:opacity-60",
            !PRESETS.some((p) => isPreset(p.focus, p.rest)) ? "sel" : "bg-chip text-chip-fg",
          )}
        >
          {t("focus.custom")}
        </button>
      </div>

      {/* ring */}
      <div className="relative mx-auto mt-8 aspect-square w-full max-w-[300px]">
        <div aria-hidden className="absolute inset-8 rounded-full bg-secondary/10 blur-2xl dark:hidden" />
        <svg viewBox="0 0 280 280" className="relative size-full -rotate-90" aria-hidden>
          <defs>
            <linearGradient id="ring" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" style={{ stopColor: "var(--chart-1)" }} />
              <stop offset="1" style={{ stopColor: "var(--chart-2)" }} />
            </linearGradient>
          </defs>
          <circle cx="140" cy="140" r={R} fill="none" style={{ stroke: "var(--chip)" }} strokeWidth="14" />
          <circle
            cx="140"
            cy="140"
            r={R}
            fill="none"
            stroke={state.phase === "focus" ? "url(#ring)" : "var(--cat-green)"}
            strokeWidth="14"
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={C * (1 - progress)}
            style={{ transition: state.running ? "stroke-dashoffset 250ms linear" : "stroke-dashoffset 300ms ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-sm font-semibold tracking-[0.2em] text-muted uppercase">
            {state.phase === "focus" ? t("focus.focusPhase") : t("focus.breakPhase")}
          </span>
          <span className="mt-1 text-6xl font-bold tabular-nums" role="timer" aria-live="off">
            {String(mm).padStart(2, "0")}:{String(ss).padStart(2, "0")}
          </span>
        </div>
      </div>

      <div className="chrome mt-8 flex items-center justify-center gap-4">
        <button
          type="button"
          onClick={() => {
            logSession(state, false, Date.now());
            setState((s) => timer.reset(s));
          }}
          aria-label={t("focus.reset")}
          className="flex size-14 items-center justify-center rounded-full bg-surface-2 text-muted"
        >
          <RotateCcw className="size-6" aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => {
            const at = Date.now();
            setNow(at);
            setState((s) => (s.running ? timer.pause(s, at) : timer.start(s, at)));
          }}
          className="btn-primary flex h-16 min-w-40 items-center justify-center gap-2 rounded-full px-8 text-lg font-semibold"
        >
          {state.running ? <Pause className="size-6 fill-current" aria-hidden /> : <Play className="size-6 fill-current" aria-hidden />}
          {state.running ? t("focus.pause") : state.remainingMs < total ? t("focus.resume") : t("focus.start")}
        </button>
      </div>

      <p className="mt-8 text-center text-sm text-muted">
        {t("focus.todayMinutes")}: <span className="font-semibold text-fg tabular-nums">{focusToday} {t("focus.minutes")}</span>
      </p>

      <OptionSheet
        open={picker}
        onClose={() => setPicker(false)}
        title={t("focus.pickTask")}
        value={state.itemId}
        onChange={(itemId) => setState((s) => ({ ...s, itemId }))}
        options={[{ value: null, label: t("focus.freeFocus") }, ...openTasks.map((i) => ({ value: i.id, label: i.title }))]}
      />

      <Sheet
        open={customOpen}
        onClose={() => setCustomOpen(false)}
        title={t("focus.custom")}
        footer={
          <Button
            className="w-full"
            onClick={() => {
              setPreset(custom.focus, custom.rest);
              setCustomOpen(false);
            }}
          >
            {t("action.done")}
          </Button>
        }
      >
        <div className="grid grid-cols-2 gap-3">
          {(["focus", "rest"] as const).map((k) => (
            <label key={k} className="block">
              <span className="mb-1.5 block text-sm text-muted">{k === "focus" ? t("focus.focusPhase") : t("focus.breakPhase")} ({t("focus.minutes")})</span>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={k === "focus" ? 180 : 60}
                value={custom[k]}
                onChange={(e) => setCustom((c) => ({ ...c, [k]: Math.max(1, Math.min(k === "focus" ? 180 : 60, Number(e.target.value) || 1)) }))}
                className="h-14 w-full rounded-2xl border border-line bg-surface-2 px-4 text-lg font-semibold tabular-nums"
              />
            </label>
          ))}
        </div>
      </Sheet>

      <Sheet
        open={finishedItem !== null}
        onClose={() => setFinishedItem(null)}
        title={t("focus.finishedTitle")}
        footer={
          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={() => setFinishedItem(null)}>
              {t("focus.keepGoing")}
            </Button>
            <Button
              className="flex-1"
              onClick={() => {
                const it = (items ?? []).find((i) => i.id === finishedItem);
                if (it && it.status === "open") actions.toggleDone(it);
                setState((s) => ({ ...s, itemId: null }));
                setFinishedItem(null);
              }}
            >
              {t("action.done")}
            </Button>
          </div>
        }
      >
        <p>{t("focus.markDone", { title: (items ?? []).find((i) => i.id === finishedItem)?.title ?? "" })}</p>
      </Sheet>
    </div>
  );
}
