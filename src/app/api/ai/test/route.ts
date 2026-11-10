import { withAuth, json } from "@/lib/server/api";
import { env, isDemoMode } from "@/lib/server/env";
import { enforceAiRateLimit } from "@/lib/server/rate-limit";
import { buildParseContext } from "@/lib/ai/context";
import { GeminiProvider, listGeminiModels } from "@/lib/ai/gemini";
import { AiParseError, parseWithRetry } from "@/lib/ai/parse";
import { BENCH_CASES, checkBench, pct } from "@/lib/ai/bench";
import { createSupabaseServer } from "@/lib/supabase/server";
import type { AppContext } from "@/lib/server/context";

// Gemini calls are capped at 50 s in total (see GeminiProvider), safely inside this limit.
export const maxDuration = 60;
const SAMPLE = "Axşama görüş olacaq onu qeyd et Dostlarla görüş saat 20.30da";
/** stop starting new benchmark runs after this much time, so the answer arrives before the 60 s limit */
const BENCH_BUDGET_MS = 42_000;

/**
 * Signed-in diagnostics for the AI setup.
 *
 * Without parameters: one real Gemini call with a fixed sentence, reporting env vars present,
 * the key's first 4 characters (never the key), every model tried, HTTP statuses, Google's
 * exact error messages, latency and the parsed result.
 *
 * With ?runs=N (1–10) [&model=<id>]: a speed + accuracy benchmark. Each run repeats the
 * server stages of a text task (auth, rate-limit count, parse context, Gemini) with one of
 * the fixed test sentences, and the answer is checked against the expected items. Returns
 * p50/p90 per stage. With `model`, only that model is used (no fallback), to compare models.
 */
export const GET = withAuth(async (ctx, req) => {
  const report: Record<string, unknown> = {
    env: {
      AI_PROVIDER: env.aiProvider || "(not set → gemini)",
      GEMINI_API_KEY_present: Boolean(env.geminiKey),
      GEMINI_API_KEY_prefix: env.geminiKey ? env.geminiKey.slice(0, 4) : null,
      GEMINI_MODEL: env.geminiModel || "(not set → default)",
    },
    region: process.env.VERCEL_REGION ?? "(local)",
  };
  const provider = (env.aiProvider || "gemini").toLowerCase();
  if (provider !== "gemini") return json({ ...report, ok: false, error: `AI_PROVIDER is "${provider}", not "gemini"` }, 400);
  if (!env.geminiKey) return json({ ...report, ok: false, error: "GEMINI_API_KEY is not set in this deployment" }, 503);

  await enforceAiRateLimit(ctx.repo, "parse");
  const runs = Number(req.nextUrl.searchParams.get("runs") ?? 0);
  if (runs > 0) return json({ ...report, ...(await bench(ctx, Math.min(10, Math.floor(runs)), req.nextUrl.searchParams.get("model"))) });

  const gemini = new GeminiProvider();
  const t0 = Date.now();
  let result: unknown = null;
  let error: string | null = null;
  try {
    result = await parseWithRetry(gemini, SAMPLE, await buildParseContext(ctx));
  } catch (err) {
    error = err instanceof AiParseError ? err.code : err instanceof Error ? err.message : String(err);
  }
  const last = gemini.attempts.at(-1);
  const failed = gemini.attempts.filter((a) => !a.ok);
  const body = {
    ...report,
    input: SAMPLE,
    ok: !error,
    ms: Date.now() - t0,
    models_in_order: gemini.models,
    model_used: gemini.modelUsed,
    fallback_used: Boolean(gemini.modelUsed && gemini.modelUsed !== gemini.models[0]),
    http_status: last?.status ?? null,
    google_error: failed.at(-1)?.error ?? null,
    attempts: gemini.attempts,
    error,
    result,
    available_models: error ? (await listGeminiModels()).filter((m) => /flash/i.test(m)) : undefined,
  };
  return json(body, error ? 502 : 200);
});

async function bench(ctx: AppContext, runs: number, model: string | null) {
  const started = Date.now();
  const rows: Record<string, unknown>[] = [];
  for (let i = 0; i < runs && Date.now() - started < BENCH_BUDGET_MS; i++) {
    const c = BENCH_CASES[i % BENCH_CASES.length];
    const stages: Record<string, number> = {};
    const time = async <T,>(name: string, work: () => Promise<T>) => {
      const t = performance.now();
      try {
        return await work();
      } finally {
        stages[name] = Math.round(performance.now() - t);
      }
    };
    if (!isDemoMode()) await time("auth", async () => (await createSupabaseServer()).auth.getUser());
    await time("db_rtt", () => ctx.repo.getProfile());
    await time("rate", () => ctx.repo.countAiRequestsSince(new Date(Date.now() - 3_600_000).toISOString()));
    const parseCtx = await time("context", () => buildParseContext(ctx));
    const gemini = model ? new GeminiProvider(env.geminiKey, model, fetch, { fallback: false }) : new GeminiProvider();
    let errors: string[] = [];
    let error: string | null = null;
    try {
      const result = await time("ai", () => parseWithRetry(gemini, c.text, parseCtx));
      errors = checkBench(c, parseCtx, result);
    } catch (err) {
      error = err instanceof AiParseError ? err.code : err instanceof Error ? err.message : String(err);
    }
    rows.push({
      run: i + 1,
      text: c.text.slice(0, 40),
      ok: !error,
      correct: !error && errors.length === 0,
      mismatches: errors.length ? errors : undefined,
      error: error ?? undefined,
      stages,
      ai_calls: gemini.attempts.map((a) => `${a.model} ${a.ok ? "ok" : (a.status ?? "err")} ${a.ms}ms${"hedge" in a && a.hedge ? " hedge" : ""}`),
    });
  }
  const stageNames = ["auth", "db_rtt", "rate", "context", "ai"];
  const ok = rows.filter((r) => r.ok);
  const summary = Object.fromEntries(
    stageNames.map((s) => {
      const v = ok.map((r) => (r.stages as Record<string, number>)[s]).filter((x): x is number => typeof x === "number");
      return [s, { p50: pct(v, 50), p90: pct(v, 90) }];
    }),
  );
  return {
    ok: ok.length > 0,
    model: model ?? `${env.geminiModel || "default"} (+ fallback)`,
    runs_done: rows.length,
    succeeded: ok.length,
    correct: rows.filter((r) => r.correct).length,
    total_ms: Date.now() - started,
    summary,
    runs: rows,
  };
}
