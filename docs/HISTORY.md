# Swift — project history

A chronological log of the whole project, from the first message (2026-11-09) to the latest change.
It records what İsrafil asked, what was built, the decisions behind it, rejected options, bugs, and design feedback.
Read this before changing anything. **No secrets are recorded here.** API keys, client secrets and tokens live only in Vercel and Supabase.

- Original spec: [`docs/PROMPT.md`](PROMPT.md) (saved verbatim). Setup guide for a non-developer: [`SETUP.md`](../SETUP.md).
- Repository: `iisgandarov/swift`. Working and deploy branch: **`claude/swift-v1`**. Vercel deploys production from it.
- Production URL: https://swift-sand-pi.vercel.app
- Claude Artifact version (separate, see Phase 2): https://claude.ai/artifact/1uRACCrcuksMGuvjFksPV6
- Owner / only allowed user: İsrafil (`isgandarov.israfil@gmail.com`). Timezone Asia/Baku. Writes in Azerbaijani.

---

## Working with İsrafil (lessons learned)

- **He is not a developer.** For dashboards (Supabase, Google Cloud, Vercel), give **one step at a time**, in simple Azerbaijani, with the exact button names he will see, then wait for "oldu" or a screenshot. Long multi-step lists frustrated him: *"a kisi bu nedir yazmisan onu ac bunu ac"* ("man, what is this, open this, open that"). After that we switched to single steps, and it went well.
- He often answers with screenshots. Read them carefully: they showed the real errors every time.
- Never ask him to paste secrets in chat. He once posted a screenshot with an OAuth client secret; we rotated it afterwards (see Phase 4).
- He wants **commits after each item**, a **short report** at the end, and screenshots of visual changes.
- He doesn't want infrastructure prompts he didn't ask for. In round 2 he **declined creating a new cloud environment** and asked not to request the Gemini key: *"The key lives only in Vercel… I will test it myself on the deployed app."*
- "Mockups win for visuals, the brief wins for behaviour." Later feedback (true dark mode, calmer accents) overrides the original mockups.

---

## Phase 0 — Brief and plan (2026-11-09 morning)

**Asked:** the full build brief (now `docs/PROMPT.md`) plus four images: light/EN mockup, the logo, dark/AZ mockup, and the brand book. A voice-first PWA task manager in AZ/EN with tasks and events, auto-sync of events to Google Calendar, Supabase, Vercel, and AI behind a provider interface (OpenAI at that time). He asked to "start in plan mode … wait for my OK, then build milestone by milestone".

**Done:**
- The working folder was empty; nothing existed yet.
- Asked two blocking questions:
  1. Where to push? He chose "I'll give a repo name" but didn't type one, so commits stayed local until Phase 3.
  2. Credentials? He chose **"Build with mocks first"**: build everything against mocks, real keys later via SETUP.md.
- Wrote the plan (stack, folder layout, data model, decisions, milestones, verification). He approved it.

**Key plan decisions (and why):**
- **Next.js 16.4.5**, the current stable version at the time. It has breaking changes vs older Next.js: `middleware` is now **`proxy.ts`**, and Turbopack is the default. Read `node_modules/next/dist/docs/` before changing framework-level code (see `AGENTS.md`).
- **All writes go through `/api/*` route handlers**, so validation (zod), the task/event rules and Google sync live in one place. Reads also go through the API for one code path.
- **`Repo` interface** with a Supabase implementation and an in-memory **DemoRepo**. **Demo mode** (fake user "İsrafil", sample data, mock AI, fake Google Calendar) lets everything run and be tested without keys. It is never enabled in production unless `SWIFT_DEMO=1`; the e2e tests use that.
- Extra table **`ai_requests`** for the 30-requests-per-hour AI rate limit. Extra flag `needs_reconnect` on `google_connections`.

---

## Phase 1 — Milestones 1–7 (commits `9a21abc` … `3536f80`, 2026-11-09)

### M1 Foundation (`9a21abc`)
- Scaffolded with create-next-app. It enabled `cacheComponents` and `partialPrefetching`; we **turned both off**, because this is an authenticated, cookie-driven app (locale and theme cookies make every page dynamic anyway), and turning them off avoided Suspense requirements everywhere.
- Tailwind v4 with brand tokens as CSS variables (`src/app/globals.css`), and a `.dark` class set **before first paint** by an inline script (`theme-script.tsx`) reading the `swift_theme` cookie, so there's no theme flash.
- next-intl **without a locale in the URL** (cookie `swift_locale` → Accept-Language), so it feels like a native app. All strings are in `messages/az.json` and `messages/en.json`, with a test that both have the same keys.
- **App icon rebuilt as SVG** (`scripts/generate-icons.mjs`). `logo.png` had a dark fringe, so the icon was redrawn: gradient square, white "Swift" turned into vector paths with opentype.js from Inter Bold, and a translucent bird. PNGs 180/192/512/maskable are generated with sharp. opentype.js's text shaper crashed on Inter's tables, so glyphs are laid out manually.
- **Hand-written service worker** (`public/sw.js`) instead of Serwist. Serwist's Next plugin needs webpack, and Next 16 builds with Turbopack.
- App shell: bottom nav, desktop sidebar, FAB (tap / long-press), offline pill, skeletons.

### M2 Data & auth (`c1c2453`)
- `supabase/migrations/0001_init.sql`: enums, tables, **RLS on every table**. `google_connections` has **no client policies**; only the service role reads it, because it stores the encrypted refresh token. A trigger checks that a category belongs to the same user.
- `src/lib/domain/rules.ts`: the task/event rules. A clock time means event; no time means task. An event without an end gets the default length. Midnight crossing is handled. `planSync` decides create, update or delete in Google. Completing an item is app-only.
- `src/lib/dates`: Baku-aware helpers, Monday-first weeks, the exact AZ weekday labels "B.E., Ç.A., Ç., C.A., C., Ş., B." and AZ month names.
- `proxy.ts` gate: signed out → `/login`; email not in `ALLOWED_EMAILS` → `/private`. `/auth/callback` exchanges the code, deletes accounts that aren't allowed, and seeds the profile and default categories (İş/Work, Görüş/Meeting, Şəxsi/Personal, EduPo, TLB Academy).

### M3 Manual tasks (`94216a9`)
- Home per the mockup: greeting by time of day, filter chips, Today section with overdue first, upcoming days, No date, a daily bilingual quote, the bell sheet, swipe to complete or delete with undo, and the ⋮ menu. There's a confirmation sheet before delete (no `confirm()`).
- New Task / Edit form with bottom-sheet pickers. The Task|Event toggle switches to Event automatically when a time is chosen.
- React Query cache persisted to IndexedDB.
- **Interpretation:** in item rows, the coloured **dot = priority** (red high, amber medium, blue low) and the **chip = category**. That was our reading of the brief's "Work = blue chip + amber dot". Calendar dots use the category colour.
- **Bugs fixed:** the 90-minute chip said "1.5.5 h". Completing an undated task made it vanish instantly; now items completed today stay visible (struck through).

### M4 Voice (`2481419`)
- `useRecorder`: MediaRecorder with mime detection (iOS `audio/mp4`, Chrome `audio/webm`), level meter, 60 s cap, auto-stop after 2.5 s of silence, cancel, and a permission-denied help sheet.
- `AiProvider` interface with an OpenAI implementation (models from `STT_MODEL` / `PARSE_MODEL`, strict JSON schema) and an **offline mock** for demo mode.
- System prompt (`src/lib/ai/prompt.ts`) with all the brief's AZ date/time rules, the **"next Friday = Friday of next week"** convention, and the five few-shot examples. AI output is validated with zod and retried once.
- Confirmation sheet: one editable card per item, highlights for uncertain fields, record again, create all. Optional "create without confirmation" with a 5 s undo.
- **Bugs fixed:** in the mock parser, the regex `\b` doesn't work after Azerbaijani letters (ə, ü), so it now uses a lookahead. Specific category names now beat generic ones ("EduPo" over "Görüş"). The test fixture needed real UUIDs.

### M5 Google Calendar (`a58c116`)
- A separate "Connect Google Calendar" OAuth flow (scopes `calendar.events` + `calendar.readonly` + `openid email`, offline, consent). The OAuth state is HMAC-signed with a nonce cookie.
- The refresh token is stored with **AES-256-GCM** (`TOKEN_ENCRYPTION_KEY`); access tokens are refreshed server-side.
- Sync never throws. On failure the item keeps its data with `sync_status = failed` and a Retry badge. A revoked token sets `needs_reconnect` and shows a banner; an event deleted in Google (404/410) is marked unsynced.
- `/api/calendar/events` reads Google events for a range, caches them briefly, and skips Swift-created events.

### M6 Calendar, Focus, Stats, Settings (`b2c21b9`)
- Calendar: swipeable week strip, month grid sheet, and a day agenda mixing Swift items with read-only Google events. It's also the right-hand panel on desktop Home.
- Focus: a Pomodoro timer **based on timestamps**, so it survives screen lock; it's persisted locally, keeps the screen awake, plays a Web Audio chime, and asks "mark task done?".
- Stats and Settings (including the category manager and JSON export).
- **Bugs fixed:** "GET THİNGS DONE" uppercased with a Turkish/Azerbaijani İ, fixed with `lang="en"` on English strings. The Focus ring track was invisible in light mode.

### M7 Polish (`3536f80`)
- **Offline:** routes not visited online failed offline, because their JS chunks weren't cached. Now the service worker caches every script and stylesheet referenced by each page it caches. Focus loaded lazily and broke offline, so it now uses a client-only mount gate.
- **Contrast:** muted text was 4.47:1 and danger red failed, both fixed. Lighthouse then gave accessibility 100 and best practices 100. Performance was 87–95: borderline, limited by JavaScript start-up time.
- SETUP.md (step by step for a non-developer, including the **Google "Testing" 7-day token expiry** warning), README, error/404 pages.
- Tests at that point: 78 unit and 6 e2e.

---

## Phase 2 — Claude Artifact version (2026-11-09 midday)

**Asked:** *"publish Swift as a Claude Artifact so I can open it via a claude.ai link (like Lovable's Publish). Do NOT change or delete the existing Next.js project. Work in a new folder: /artifact."* It should use runtime capabilities instead of a server: `db` + `user`, `sample` (replaces OpenAI), and `mcp` (his Google Calendar connector). It should handle missing capabilities gracefully.

**Done:**
- A single file `/artifact/swift.html` (outside the repo). React 18 UMD from cdnjs, `htm` instead of JSX, the same tokens and screens.
- Published at **https://claude.ai/artifact/1uRACCrcuksMGuvjFksPV6** (private, icon "checklist").
- `db` with **owner-only rules** (`read/write: owner`), collections `items`, `categories`, `focus`, `meta/settings`. Default categories are seeded on first open.
- `sample` parses text with the same rules, plus a 15-day date table so the model never computes weekdays.
- `mcp` with the Google Calendar `list_events` / `create_event` / `update_event` / `delete_event` tools. Argument names were taken from the session's tool schemas, and the `list_events` result shape from one real read-only call.
- Storage was verified with a write → read → delete probe; a viewer-level read returned nothing, confirming the owner-only rule.

**Decisions and why:**
- **The microphone doesn't work in artifacts.** The artifact frame refuses device APIs, so voice became a large text field with the hint "Klaviaturadakı 🎤 ilə danış / Use your keyboard's 🎤 to dictate". The glowing button became **"Anla / Understand"**.
- `create_event`'s result shape couldn't be checked without creating a real event, so the page reads the id defensively. This is still unverified.
- The artifact file was **deliberately not committed** to the repo. When we pushed, he clarified: *"articat olan yox diger anladin?"* (not the artifact, the other one).

**Artifact vs Next.js:** the artifact needs no keys (it uses his Claude account) but has no microphone and keeps its own separate data. The Next.js app is the main product.

---

## Phase 3 — GitHub (2026-11-09 midday)

- *"Sen menim bu layihemi github yuklemisen"* → no; the commits were local only.
- *"Ozun etde layiheni claude/swift-v1"* → creating a repo from this session isn't possible ("sessions are bound to their configured repositories"). As a fallback he got `swift-source.zip` and `swift.bundle` files.
- He created **`iisgandarov/swift`**, attached it, and we pushed branch `claude/swift-v1`. Note: the repo was created **public**; we recommended making it private.

---

## Phase 4 — Deploying to Vercel and Supabase (2026-11-09 afternoon)

He deployed via Vercel. The Supabase project ("supabase-cyclamen-candle") came from the **Vercel Supabase integration**, which set the env vars with *new* names. Problems in order:

1. `Unsupported provider: provider is not enabled`: Google wasn't enabled in Supabase Auth. We walked through Supabase → Authentication → Sign In / Providers → Google.
2. **Created the Google OAuth client** step by step (consent screen with app name / External / contact, then a Web application client). Redirect URIs: the Supabase `/auth/v1/callback` and `https://swift-sand-pi.vercel.app/api/google/callback`; JavaScript origin: the Vercel URL.
3. **Secret exposure:** his screenshot showed the client secret. Google later wouldn't show it again, so we used **"Add secret"** to create a new one and advised deleting the old one. ⚠️ Follow-up: make sure the old secret is deleted.
4. `missing OAuth secret`: the secret field in Supabase was empty.
5. Redirect to `localhost:3000` with `Unable to exchange external code`: the Supabase **Site URL** was still localhost, and the secret was wrong. Fixed the Site URL, Redirect URLs, and the secret (copied with the 📋 icon, not retyped).
6. **"This app is private."**: Google sign-in worked, but the allowed-emails gate refused. We added `ALLOWED_EMAILS` in Vercel and redeployed.
   - Code `d84a959`: accept the integration's key names (`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`) as fallbacks. The private page now shows which email was refused.
7. **HTTP 500 on `/auth/callback`**: the tables didn't exist (the migration hadn't been run; Supabase said "No migrations"). He ran `0001_init.sql` in the SQL Editor.
   - Code `78657d6`: if first-run setup fails, show a clear message instead of a 500.
   - Result: **"isledi ela"** — sign-in works.
8. **Voice failed:** no OpenAI key. He asked *"ses meselesini claude baglaya bilersen"* (can you hook voice up to Claude?). We explained that **Claude has no speech-to-text**; it can only parse text. Options were: phone keyboard dictation + Claude, the artifact, or staying on OpenAI. He later chose **Gemini** (Phase 5).
9. **Google Calendar won't connect** ("Google OAuth isn't configured on the server"): Vercel is missing `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` and `TOKEN_ENCRYPTION_KEY`. The Supabase provider settings only cover sign-in. We also explained **Publish app** (Testing → In production) to avoid the 7-day expiry. Whether he completed this is not confirmed.

---

## Phase 5 — "Swift fixes — round 2" (2026-11-09 evening, commits `dbd2861` … `cdb5b25`)

He sent six items and asked for "commit after each, push at the end, short report". Mid-way he said: ***"Skip item 2 (offline). It already works well. Don't change the service worker or offline logic."*** The service worker and offline logic were left untouched.

### 1. Tab navigation lag (`dbd2861`)
- **Asked:** switching tabs feels slow; it must feel instant (<100 ms), find the cause first, highlight on pointerdown, render the tabs client-side, never show a blank screen.
- **Cause:** each tab was a separate dynamic server route; the root layout reads cookies. Every tap made an RSC request through `proxy.ts` (Supabase session check) to the Vercel function in US East. The tab highlight followed the URL, so it waited for that round-trip. Prefetching only helped for about 30 s.
- **Fix:** one client **AppShell** (`src/components/shell/app-shell.tsx`) picks the screen from the URL. The tab screens stay mounted (all mounted right after first paint) and switch by visibility. Navigation uses `history.pushState` via `src/lib/client/nav.ts`; Next.js syncs this into `usePathname`, so there's no RSC fetch. Tabs highlight on pointerdown, and each tab keeps its scroll position. The route files now just `return null` so deep links and reloads still work.
- **Measured** (`scripts/perf-tabs.mjs`, 4× CPU and 150 ms RTT):
  - Before: highlight about 69 ms (up to 110 ms), and **13 server requests per 5 switches**.
  - After: highlight about **8 ms**, screen about **56 ms**, **0 server requests**.
- Related fix in `185540b`: after a reload, the saved IndexedDB cache could be up to 1 s stale. With `staleTime` it could then show old data for 30 s. Now everything is refreshed in the background after the cache is restored. This was found by the e2e smoke test.

### 2. Offline — skipped by request.

### 3. True dark mode + calmer accents (`dce2813`)
- **Asked:** *"Dark mode must be TRUE dark, not navy"*: #000 / #121212 / #1C1C1E / #2C2C2E, text #F2F2F2 / #9A9A9A, no blue gradient background and no glows. A softer blue, used sparingly. *"The + FAB and the profile avatar are too loud in BOTH themes."*
- **Done:** a new dark palette and the soft accent **#7BA4F0** (active tab, links, selected chip text, small icons). Semantic utilities `btn-primary`, `sel`, `seg-on`, `fab` and `avatar` replace hard-coded blue fills and gradients. Dark primary buttons are neutral (#F2F2F2 with black text). The FAB is a neutral surface with the normal icon colour; the avatar is a grey circle with initials. Glows are hidden in dark.
- **WCAG AA** checked for every key pair. The light primary gradient failed with white text (2.74:1) and was darkened to `#1667F5 → #0050EB` (≥ 4.89:1). The toast action got its own token.

### 4. "+" opens a choice first (`3e8a2ff`)
- **Asked:** + opens a sheet with **🎤 "Səsli tapşırıq" / "Voice task"** and **⌨️ "Mətnli tapşırıq" / "Text task"**. Separate, focused screens. Long-press still starts voice. Rename "Səsli versiya" → "Səsli tapşırıq" and "Voice" → "Voice task" everywhere.
- **Done:**
  - `src/components/shell/add-choice.tsx` (also used by the sidebar's "New task" button).
  - `/new/voice` (`voice-task-screen.tsx`): starts listening immediately, one big mic button, language toggle. A transcript kept after an AI failure can be opened on the text screen.
  - `/new/text` (`text-task-screen.tsx`).
  - Renamed in az.json and en.json and in the manifest shortcuts. The old combined screen and the voice button component were removed.

### 5. Task card layout (`aedaa36`)
- **Asked:** the title sticks to the top with empty space below; find the cause; height should follow content; one vertical centre line; 2-line titles.
- **Cause:** the row had a fixed `min-h-[76px]`, and the meta row (time · badges · category) was always rendered with its own `min-h-6` and margin, even when empty.
- **Fix:** the meta row renders only when it has data, and a lone category chip sits under the title. Padding is equal top and bottom with no fixed height. The ⋮ button keeps its 44 px target without growing the row. Titles are clamped to 2 lines. Screenshots were checked for: title only, + time, + category, completed, overdue, long titles, AZ/EN, light/dark.

### 6. Google Gemini as the AI for voice and text tasks (`185540b`, `cdb5b25`)
- **Asked:** use **Google Gemini (AI Studio, free tier) as the only provider**. Remove OpenAI from the active flow (keeping it optional is OK). The key is in Vercel as `GEMINI_API_KEY` and must be server-only. Voice: send the audio directly, **one call returns transcript + items**. Text: on Create, send to Gemini and auto-fill. Short titles without filler words ("onu qeyd et", "qeyd et", "yadıma sal", "xatırlat", "olacaq", "remind me", "note that"). Every time form must work ("20.30", "20:30", "20.30da", "20:30-da", "saat 8-də", "8 tamamda", "axşam 7", "səhər 9"), and "axşama" / "bu axşam" means today evening. Show a confirmation sheet; **"My manual changes always win."** Retry once, then a clear message, keeping the text.
- **Why Gemini:** it has a free tier and accepts **audio input**, so one call both transcribes and parses (OpenAI needed two paid calls). Claude was ruled out for in-app voice because it has no speech-to-text API.
- **Done:**
  - `src/lib/ai/gemini.ts`: REST `generateContent`, key in the `x-goog-api-key` header (never in the URL or the browser), `responseMimeType: application/json` + `responseJsonSchema`, `temperature 0.1`. Default model `gemini-3.8-flash`, overridable with `GEMINI_MODEL`.
  - `AiProvider` now has `parseItems(text)` and `parseAudio(audio)`. OpenAI is kept as an optional provider (two calls); the mock is used for demo mode.
  - **Audio is re-encoded on the device to 16 kHz mono WAV** (`src/lib/client/wav.ts`), so Gemini gets a format it accepts; the raw recording is the fallback.
  - The prompt now has a 15-day date table, every time form, the filler list, "axşama = today evening", "one item described twice is ONE item", and his two sentences as examples 6–7.
  - `src/lib/ai/parse.ts`: **any failure (invalid JSON, network, 5xx, quota) is retried once**, then a coded error (`ai_quota`, `ai_unavailable`, `ai_parse_failed`, `ai_not_configured`). A rejected key isn't retried. The UI shows a clear message per code and keeps the text or transcript.
  - Text task: **Create → AI → confirmation sheet**. Fields set by hand in the form override the AI (`applyManualChoices` in `src/lib/domain/drafts.ts`). If the AI fails, the next tap of Create saves the text as typed. Offline, it saves as typed directly.
  - `/api/ai/test` (signed-in only): one real Gemini call with the "Axşama görüş…" sentence, showing provider, model, timing and result. If it fails, it lists the Flash models the key can use. No key is exposed.
- **Not verified live.** Google's docs site was blocked from the build container. The model name comes from Google's examples found by search. He declined a new environment and storing the key in the container, and will test on the deployed app.
- **Tests:** 92 unit tests (including mocked Gemini responses for both of his sentences: "Dostlarla görüş" today 20:30–21:30, and EduPo event + high-priority Power BI task) and 10 e2e tests, light and dark.

---

## Phase 6 — Gemini fails in production (2026-11-09 night)

**Reported:** "Gemini fails for BOTH voice task and text task. After a long 'Understanding...' the app shows 'Something went wrong while understanding' / 'Couldn't understand that'." Env in Vercel: `AI_PROVIDER=gemini`, `GEMINI_API_KEY` (new AI Studio key), `GEMINI_MODEL=gemini-3.8-flash`. He asked to check the model name with fallback, timeouts and thinking, key/env reading, the request format (webm/opus from Android), and to improve `/api/ai/test` and the server logs. Mid-way: ***"my free model is Gemini 3.1 Flash-Lite, not 3.8. I set GEMINI_MODEL=gemini-3.1-flash-lite in Vercel. Put it first in the fallback chain and keep thinking minimal."***

**Cause (from the code; live logs weren't visible to us):**
- Each Gemini call had a **45 s** timeout, and a failure was retried once. A slow request could therefore need about **90 s+**, but the Vercel route is capped at **60 s**.
- Newer Gemini models "think" by default, and our prompt is long, so calls were slow.
- When Vercel killed the function, the browser got a non-JSON 504. The app mapped that to the generic "Something went wrong" after a long spinner.
- On top of that, `gemini-3.8-flash` is not his free-tier model. A 404, or a 429 "limit: 0", would also have failed every call.

**Fixed:**
- **Time budget:** 50 s in total and 25 s per Google call; a retry happens only if ≥ 10 s remain. Routes keep `maxDuration = 60`. The client gives up after 65 s with a clear "took too long" message, and a platform 504 is shown as a timeout.
- **Thinking set to the lowest level** per model: Gemini 3.x / `-latest` → `thinkingLevel: "minimal"`; 2.5 Flash → `thinkingBudget: 0`. If a model rejects the setting, it's dropped automatically. A rejected `responseJsonSchema` falls back to plain JSON mode, with zod still validating.
- **Model fallback:** `GEMINI_MODEL → gemini-3.1-flash-lite → gemini-flash-latest → gemini-2.5-flash`. Default `gemini-3.1-flash-lite`. It moves on for 404, model-permission 403, "not supported" 400, and 429 "limit: 0". An ordinary rate limit stays a quota error. The model used is logged, and a retry stays on that model.
- **Audio:** Android `audio/webm;codecs=opus` is normalised to `audio/webm` if the on-device WAV conversion fails; WAV stays the normal path. Endpoint: AI Studio `generativelanguage.googleapis.com/v1beta/models/{model}:generateContent`, key in the `x-goog-api-key` header.
- **Logs:** every failed Google call is written to Vercel Runtime Logs as `[gemini] call failed {model, status, ms, error, thinking, schema}`, with Google's exact message and never the key.
- **`/api/ai/test`** now shows: env present yes/no, the key's first 4 characters, the model order, the model used and whether a fallback was used, HTTP status, Google's exact error, every attempt, latency in ms, and the parsed result for "Axşama görüş olacaq onu qeyd et Dostlarla görüş saat 20.30da". On failure it also lists the Flash models his key can use.
- Tests: 103 unit tests, including fallback, thinking, schema, timeout and mime cases.

---

## Phase 7 — Speed, a production fix, logo and categories (2026-11-10, `e6c708b` … `34cc2f7`)

- **Speed** (`e6c708b`–`fdf9490`): Settings → Speed (p50/p90 per stage, Server-Timing) and `/api/ai/test?runs=N&model=…`; rate limit and context run in parallel, auth via `getClaims`; hedged Gemini request after 3 s (text) / 4 s (voice), max 4 per minute; unavailable models remembered 10 min; prompt −31%; no pause before retry; voice trims silence; items saved in one insert with Calendar sync after the response; text tasks open an instant on-device draft ("Refining…"). He chose to skip the before/after measurement and test himself.
- **Production bug** (`d2ba2cc`): after the deploy, every text and voice request failed. Cause (inferred from the code, logs not reachable): the new `maxOutputTokens` 1500/2500 counted Gemini 3 thinking tokens, so answers were cut off empty. Raised to 8192; "minimal" thinking falls back to "low"; empty answers now log finishReason and token counts.
- **Past times** (`306146e`): "saat 7" at 17:20 became 07:00 today. Now a past bare morning hour becomes the evening if still ahead, else tomorrow, flagged for review (on-device draft and prompt); "7de" is understood.
- **Logo** (`7078d8e`): his original file is `design/logo-original.png` (pixel-identical). `scripts/generate-icons.mjs` only trims, resizes and pads it (maskable 80% safe zone). New names `swift-*.png` because the service worker serves icons cache-first; `icon-192.png` / `icon.svg` kept for its precache (service worker untouched).
- **Categories** (`484c127`): never empty. Own category name → Meeting (görüş, zəng with someone) → Work (iş, hesabat, layihə, müştəri…) → Personal. Same rules in the prompt, the on-device draft and as the fallback when the AI leaves it empty (`src/lib/domain/categorize.ts`).
- **Task card** (`34cc2f7`): small category chip right after the time, same 13 px size.
- New rule in CLAUDE.md: never commit secrets; check every diff first.

---

## Phase 8 — Tasks with a time, chosen type (2026-11-10, `c43899b` … `9935e9b`)

- **Removed** Settings → Speed and the client timing log (`c43899b`); `/api/ai/test` stays.
- **Tasks can have a time** (`767fd56`, `9f58602`): optional deadline/reminder time (`start_at`, no end), never synced to Google. No DB change. A clock time no longer makes an event.
- **Type order** (prompt + on-device parser): the user's choice (text form, or Auto / Task / Event on the voice screen and in the recording overlay) → "tapşırıq/task" or "tədbir/event" → meeting, call/zəng, plan with someone ("X ilə", "Ramizlə", "with X") → event; else task. He confirmed "X ilə" counts as an event.
- **Appointments and fixed-time activities are events** (`9935e9b`): qəbul/həkim/appointment, dərs/kurs/class/lesson, uçuş/flight, müsahibə/interview, vebinar/webinar, konsert/concert, təlim/training, toy/ad günü/party. Azerbaijani words match with case endings only ("toyuq", "kursor", "dərslik" stay tasks).
- **Switching Task ↔ Event keeps date and time** in the form and the confirmation card; an event gets the default length back.

---

## Rejected or replaced options (summary)

| Option | Outcome | Why |
|---|---|---|
| OpenAI (Whisper + GPT) | Replaced by **Gemini** (OpenAI kept optional) | Needs a paid key and two calls; Gemini has a free tier and takes audio directly. |
| Claude for voice in the web app | Rejected | No speech-to-text API; Claude could only parse text. |
| Browser Web Speech API | Rejected (brief) | Unreliable on iOS, weak for Azerbaijani. |
| Serwist | Not used | Its Next plugin needs webpack; Next 16 uses Turbopack. Hand-written `public/sw.js`. |
| `cacheComponents` / partial prefetching | Turned off | Cookie-driven, authenticated app; avoids Suspense boilerplate. |
| Per-tab server routes with `<Link>` | Replaced by a client app shell | Every tap hit the server (the round-2 lag). |
| Artifact as the main app | Kept as a side version | No microphone in artifacts, separate data; the Next.js app is the product. |
| New cloud environment and Gemini key in the container | Declined by him | Key stays only in Vercel; he tests on the deployed app. |
| Offline sync queue (round 2, item 2) | Skipped by him | "Offline mode already works well." |

---

## Open items (as of `cdb5b25`)

1. **Confirm Gemini live:** after the redeploy, open `/api/ai/test` while signed in. It should show `ok: true` and `model_used: gemini-3.1-flash-lite`. If not, `google_error` and the Runtime Logs (`[gemini] call failed`) show why.
2. **Google Calendar sync:** add `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` (`https://swift-sand-pi.vercel.app/api/google/callback`) and `TOKEN_ENCRYPTION_KEY` in Vercel, then **Publish app** in Google Auth Platform → Audience (otherwise tokens expire after 7 days). Not yet confirmed done.
3. **Delete the old (exposed) Google OAuth client secret** in Google Cloud → Clients → Web client 1, if not done yet.
4. The GitHub repo is **public**; make it private if wanted.
5. Lighthouse mobile performance was borderline (87–95) before round 2; not re-measured since.
6. The artifact still uses Claude `sample`, not Gemini; its `create_event` id handling is unverified.
7. Out of scope for v1 (code is ready to extend): recurring items, Todoist sync, push reminders, sharing.
