# Swift — voice-first task manager

> Plan Today. A Brighter Tomorrow.

Swift is a personal task manager PWA. Speak a task in **Azerbaijani or English**, and Swift turns it into **tasks** (kept in the app) or **events** (kept in the app and added to Google Calendar). It installs on your phone like a native app and also works in a desktop browser.

**Setting it up for real use?** Read **[SETUP.md](SETUP.md)**. It's written step by step for non-developers.

## Quick start (demo mode, no keys)

```bash
npm install
```

```bash
npm run dev
```

Open <http://localhost:3000>. Without Supabase settings, Swift runs in **demo mode**:

- a fake user ("İsrafil") and sample data
- an in-memory database
- a pretend Google Calendar
- an offline voice parser (any recording "transcribes" to a fixed sample sentence)

Demo mode is never enabled in a production build, unless `SWIFT_DEMO=1` is set. The e2e tests set it.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build / server |
| `npm test` | Unit tests (Vitest): dates, task/event rules, AI parsing with mocked responses, sync, stats, timer |
| `npm run e2e` | Playwright smoke + voice tests at 390×844 in light and dark (builds and starts the app in demo mode) |
| `npm run lint` / `npm run typecheck` | ESLint / TypeScript |
| `npm run icons` | Regenerates the app icons from the SVG design in `scripts/generate-icons.mjs` |

## How it fits together

```
Browser (React, React Query persisted to IndexedDB, service worker for the offline shell)
   │  all reads/writes go through /api/* route handlers
   ▼
Next.js route handlers ── zod validation ── task/event rules ── Repo interface
   │                                                    ├─ SupabaseRepo (Postgres + RLS)
   │                                                    └─ DemoRepo (in memory)
   ├─ /api/voice, /api/parse → AiProvider (OpenAI or offline mock) → zod-checked JSON
   └─ Google Calendar client (encrypted refresh token, server-side only)
```

- **`src/lib/domain/rules.ts`**: the task/event rules. A clock time makes it an event; events without an end get the default duration; a type flip creates or deletes the Google event; completing an item is app-only.
- **`src/lib/ai/prompt.ts`**: the parsing system prompt: Azerbaijani dates and times, multi-item utterances, and the "next Friday" convention, plus the few-shot examples.
- **`src/lib/server/sync.ts`**: pushes changes to Google Calendar and never throws. On failure the item keeps its data with `sync_status = failed` and a Retry badge.
- **`src/lib/dates`**: Asia/Baku-aware helpers, Monday-first weeks, Azerbaijani weekday/month labels.
- **`supabase/migrations/0001_init.sql`**: schema with row-level security on every table. `google_connections` is service-role only.
- **`messages/az.json`, `messages/en.json`**: every UI string.
- **`design/`**: the original mockups and brand book.

## Configuration

See `.env.example`. API keys are only used server-side. Model names come from `STT_MODEL` and `PARSE_MODEL`. Only addresses listed in `ALLOWED_EMAILS` can sign in.

## Not in v1 (the code is ready for it)

Recurring items, Todoist sync, push reminders, sharing. `AiProvider` and `Repo` are interfaces, and `CalendarClient` isolates Google, so new providers and sync targets plug in without touching the UI.
