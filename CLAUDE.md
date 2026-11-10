# Swift — project brief for Claude

Read docs/HISTORY.md for the full history of decisions before starting work.

## What it is
Swift is İsrafil's personal **voice-first task manager**, a PWA that should feel like a native app on his phone and also work on desktop. He speaks or types a task in **Azerbaijani or English**. AI turns it into **tasks** (kept in the app) or **events** (also synced to Google Calendar). The UI is in AZ/EN and the timezone is **Asia/Baku**. The original spec is `docs/PROMPT.md`. The non-developer setup guide is `SETUP.md`.

- Repo `iisgandarov/swift`, branch **`claude/swift-v1`**. This is also the Vercel production branch.
- Production: https://swift-sand-pi.vercel.app. The only allowed user is `isgandarov.israfil@gmail.com`.

## Stack
- **Next.js 16** (App Router, TypeScript strict, Turbopack). It's not the Next.js you know: `proxy.ts` replaces middleware. Read `AGENTS.md` and `node_modules/next/dist/docs/` first.
- Tailwind v4 with tokens in `src/app/globals.css` (light/dark via a `.dark` class), next-intl (`messages/az.json`, `messages/en.json`), React Query persisted to IndexedDB, motion, lucide-react, Recharts.
- **Supabase**: Postgres with RLS on every table, and Google sign-in. Schema is in `supabase/migrations/0001_init.sql`.
- **Google Gemini** (default AI) for voice and text tasks; OpenAI is optional; a mock is used in demo mode.
- Google Calendar through our own OAuth routes, with the refresh token AES-GCM encrypted.
- Hosted on Vercel. Tests: Vitest (`npm test`) and Playwright (`npm run e2e`, at 390×844, light and dark).

## Env var names (values live only in Vercel / .env.local — never commit or print them)
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (or `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`), `SUPABASE_SERVICE_ROLE_KEY` (or `SUPABASE_SECRET_KEY`), `ALLOWED_EMAILS`, `APP_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `TOKEN_ENCRYPTION_KEY`, `AI_PROVIDER` (gemini | openai | mock), `GEMINI_API_KEY`, `GEMINI_MODEL`, optional `OPENAI_API_KEY` / `STT_MODEL` / `PARSE_MODEL`, and `SWIFT_DEMO` (tests only).

## Key rules
- **Secrets stay server-side.** AI keys are read only in `src/lib/server/env.ts` and sent in headers, never to the browser. Never ask İsrafil to paste keys in chat.
- **Never commit secrets:** no .env files, API keys, tokens or passwords. Before every commit, check the diff for secrets. If you find one, stop and tell İsrafil.
- **No hard-coded UI strings or colors.** Use `messages/*.json` and the CSS tokens (`btn-primary`, `sel`, `seg-on`, `fab`, `avatar`, `text-accent`).
- **Navigation is client-side.** One `AppShell` renders every screen from the URL; use `navigate()` / `AppLink` from `src/lib/client/nav.ts`, not `<Link>` or `router.push`. Route files return `null`.
- **Task vs event rules** live in `src/lib/domain/rules.ts`: a clock time does NOT mean event — tasks may have an optional time and never sync to Google. Type order: the user's choice → "tapşırıq/task" / "tədbir/event" → meeting, call, plan with someone, appointment or fixed-time activity → event; else task. Switching type keeps date and time. The default event length comes from Settings, and completing an item is app-only. Google sync never loses data; on failure it sets `sync_status = failed` and shows Retry.
- **AI time budget:** Gemini calls must finish inside the 60 s route limit (50 s budget, 15 s per call, one hedged duplicate after 3 s text / 4 s voice, thinking at the lowest level, maxOutputTokens 8192 because Gemini 3 thinking counts against it). Every failed call is logged with Google's exact message as `[gemini] call failed`.
- **AI pipeline:** voice audio is converted to WAV on the device, and one Gemini call returns transcript + items. For text, tapping Create opens an instant on-device draft and the AI refines it. **Manual form choices always win.** Gemini's answer is repaired field by field (`src/lib/ai/repair.ts`), never rejected as a whole; only a real failure (no JSON, timeout, Google error) is retried once, silently, then a message with the real reason that keeps the text/draft. Titles are cleaned by `src/lib/domain/title.ts`.
- **Any change to the AI prompt, schema or item rules must keep the AI contract tests green** (`tests/unit/ai-contract.test.ts`).
- **Don't touch the service worker or offline logic** unless asked; İsrafil says offline works.
- **Design:** true dark mode (#000/#121212/#1C1C1E/#2C2C2E), a calm accent (#7BA4F0 in dark), no glows. The + button and avatar stay neutral. + opens the Voice task / Text task choice sheet. Use the names "Səsli tapşırıq / Voice task" and "Mətnli tapşırıq / Text task".
- **Working style:** commit after each item, push to `claude/swift-v1`, give a short report. When guiding İsrafil through dashboards, go **one step at a time in simple Azerbaijani**.

## Current status (2026-11-09, after the Gemini production fix)
Milestones 1–7 and round-2 items 1, 3, 4, 5 and 6 are done (item 2, offline, was skipped on purpose). Sign-in works in production. Gemini failed in production ("Understanding…" then a generic error); fixed with a 50 s time budget, minimal thinking, and the model fallback chain `GEMINI_MODEL → gemini-3.1-flash-lite → gemini-flash-latest → gemini-2.5-flash` (his free model is **Gemini 3.1 Flash-Lite**). **Live result still to be confirmed** at `/api/ai/test`. The Claude Artifact side version is at https://claude.ai/artifact/1uRACCrcuksMGuvjFksPV6; it isn't in the repo.

## Open items
1. After the Vercel redeploy, open `/api/ai/test` while signed in and confirm `ok: true` (env: `AI_PROVIDER=gemini`, `GEMINI_MODEL=gemini-3.1-flash-lite`, `GEMINI_API_KEY`).
2. In Vercel, set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` and `TOKEN_ENCRYPTION_KEY` for Calendar sync. Then publish the Google consent screen ("In production"), because Testing mode tokens expire after 7 days.
3. Delete the old, exposed Google OAuth client secret. Consider making the repo private.
4. Re-measure Lighthouse mobile performance (it was 87–95).
5. Out of scope for v1: recurring items, Todoist, push reminders, sharing.
