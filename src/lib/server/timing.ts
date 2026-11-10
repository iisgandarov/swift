import "server-only";

export interface Stage {
  name: string;
  ms: number;
  desc?: string;
}

/**
 * Per-request stage timings. Sent to the browser as a standard `Server-Timing` header,
 * so the app's speed log (Settings → Speed) and the browser dev tools can show where the
 * time went. Contains only names and milliseconds — never request data or keys.
 */
export class Timing {
  private readonly t0 = performance.now();
  readonly stages: Stage[] = [];

  /** Awaits `work` and records how long it took under `name`. */
  async time<T>(name: string, work: Promise<T> | (() => Promise<T>), desc?: string): Promise<T> {
    const start = performance.now();
    try {
      return await (typeof work === "function" ? work() : work);
    } finally {
      this.add(name, performance.now() - start, desc);
    }
  }

  add(name: string, ms: number, desc?: string) {
    this.stages.push({ name, ms: Math.round(ms), desc });
  }

  totalMs() {
    return Math.round(performance.now() - this.t0);
  }

  header() {
    const safe = (s: string) => s.replace(/[^\w .:/+-]/g, "").slice(0, 80);
    return [...this.stages, { name: "total", ms: this.totalMs() }]
      .map((s) => `${safe(s.name)};dur=${s.ms}${"desc" in s && s.desc ? `;desc="${safe(s.desc)}"` : ""}`)
      .join(", ");
  }
}

const byRequest = new WeakMap<Request, Timing>();

/** The Timing of this request (created on first use). */
export function timingFor(req: Request): Timing {
  let t = byRequest.get(req);
  if (!t) {
    t = new Timing();
    byRequest.set(req, t);
  }
  return t;
}

interface AttemptLike {
  model: string;
  ms: number;
  ok: boolean;
  status: number | null;
  hedge?: boolean;
}

/** Adds one stage per AI call (gemini_1, gemini_2, …) with model and outcome. */
export function addAiAttempts(timing: Timing, provider: unknown) {
  const attempts = (provider as { attempts?: AttemptLike[] } | null)?.attempts;
  if (!attempts?.length) return;
  attempts.forEach((a, i) =>
    timing.add(`ai_${i + 1}`, a.ms, `${a.model} ${a.ok ? "ok" : (a.status ?? "err")}${a.hedge ? " hedge" : ""}`),
  );
}
