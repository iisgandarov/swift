# Swift — Voice-first Task Manager (original build brief)

> Saved verbatim from the first message of the project (2026-11-09) so later sessions have the spec.
> The four design references it mentions are in `design/`. Later decisions changed some parts
> (most importantly: the AI provider is now **Google Gemini**, not OpenAI) — see `docs/HISTORY.md`.

You are building **Swift**, my personal task manager. It is a **web app (PWA)** that must feel like a **native mobile app** on my phone and also work well in a desktop browser. Its core feature: I **speak** a task in **Azerbaijani or English**, the app understands it, and creates **tasks** (kept in the app) or **events** (kept in the app AND pushed automatically to my Google Calendar).

Read this whole file before writing code. Start in **plan mode**: show me the plan, folder structure and data model, wait for my OK, then build milestone by milestone (see the end). Commit after each milestone.

---

## 0. Design references (look at these first)

All in `./design/`:

| File | What it is |
|---|---|
| `logo.png` | App icon (blue rounded square, white "Swift" wordmark, swift bird) |
| `brand-book.png` | Colors, typography, logo usage, tagline |
| `mockup-dark-az.png` | Dark theme, Azerbaijani UI: New Task, Home, Calendar screens |
| `mockup-light-en.png` | Light theme, English UI: same three screens |

Match these mockups closely: spacing, card shapes, chips, bottom nav, FAB, calendar week strip, colored dots. Where a screen is not in the mockups (Focus, Stats, Settings, voice confirmation sheet), design it in the same visual language.

Note: `logo.png` has dark noisy fringe around the edges. When generating app icons, crop to the rounded square and clean the edges (or rebuild the icon as SVG: rounded square with a `#2EA1FF → #0057FF` diagonal gradient, white "Swift" in Inter Bold, light-blue translucent bird behind it).

---

## 1. Brand tokens

```
Primary    #0057FF   (focus, trust, productivity — buttons, active nav, FAB, selected chip)
Secondary  #2EA1FF   (energy — gradients, highlights, mic glow)
Light      #E6F2FF   (calm — light-theme surfaces, chip backgrounds)
Dark       #0F172A   (stability — light-theme text, dark-theme base)
Font       Inter (400/500/600/700), load with latin-ext subset (needed for ə ğ ı ö ü ş ç İ)
Tagline    "Plan Today. A Brighter Tomorrow."
Sub-line   "Move forward, one task at a time."
Footer     "GET THINGS DONE. FASTER."
```

Category chip colors (from mockups): Work = blue chip + amber dot, Meeting = purple, Personal = green. Calendar event dots: blue, purple, green, orange.

### Themes (both required)
- **Light:** background `#F5F8FF`, cards white, text `#0F172A`, muted text slate-500, chips `#E6F2FF`.
- **Dark:** deep navy background (≈ `#070D1F` → `#0B1430` subtle gradient), cards ≈ `#111A33` with 1px `rgba(255,255,255,0.06)` border, text white, muted slate-400, subtle blue glow behind the primary mic button and FAB.
- Theme setting: **System / Light / Dark**, saved per user. No flash of wrong theme on load (set the class before first paint).
- Define all colors as CSS variables / Tailwind theme tokens. No hardcoded colors in components.

Style rules: large radii (16–24px cards, full pills for chips/buttons), soft shadows in light mode only, generous touch targets (min 44px), smooth 200–250ms transitions, bottom sheets for pickers, respect `prefers-reduced-motion`.

---

## 2. Tech stack

- **Next.js (App Router) + TypeScript**, deployed on **Vercel**
- **Supabase**: Postgres, Auth (Google sign-in), Row Level Security on every table
- **Tailwind CSS** with the tokens above; Framer Motion for sheets/transitions; lucide-react icons
- **next-intl** (or equivalent) for AZ/EN
- **Recharts** for stats
- **PWA**: web manifest + service worker (Serwist or equivalent)
- **AI**: server-side only, behind a provider interface (see §6). Model names come from env vars, never hardcoded.

Use current stable versions. Keep dependencies lean.

---

## 3. PWA / "feels like a real app" requirements

- `manifest.webmanifest`: name "Swift", short_name "Swift", `display: standalone`, `orientation: portrait`, theme/background colors per theme, icons 192/512 + maskable 512, `apple-touch-icon` 180.
- iOS: `apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style: black-translucent`, splash-friendly background, `viewport-fit=cover`, respect safe-area insets (notch, home indicator) on header, bottom nav and FAB.
- No browser-like behavior in standalone mode: no text selection on UI chrome, no pull-to-refresh bounce on the shell, no 300ms tap delay, inputs ≥16px font (prevents iOS zoom).
- Bottom tab navigation on mobile, instant screen switches (client-side), skeleton loaders instead of spinners.
- Service worker caches the app shell and last loaded data so the app opens offline (read-only). Show a small "Offline" pill when offline; disable voice while offline.
- Optional nice touch: `navigator.vibrate(10)` on complete/create (Android only, ignore elsewhere).
- An "Install Swift" hint in Settings with short instructions for iPhone (Share → Add to Home Screen) and Android.

### Desktop layout
Same design language, adapted: left sidebar replaces bottom nav; Home shows task list + a right-side panel with the calendar/week view; max content width ~1200px. The New Task screen becomes a centered modal/sheet.

---

## 4. Languages (AZ + EN)

Two separate settings:
1. **UI language**: Azərbaycan / English. Default from browser, switchable in Settings, saved per user.
2. **Voice language**: Auto / AZ / EN. A small AZ|EN|Auto toggle sits next to the mic button. Auto is default.

All UI strings live in `messages/az.json` and `messages/en.json`. No hardcoded strings in components. Use these labels (from my mockups):

| Key | AZ | EN |
|---|---|---|
| nav.home | Ana səhifə | Home |
| nav.calendar | Təqvim | Calendar |
| nav.focus | Fokus | Focus |
| nav.stats | Statistika | Stats |
| nav.settings | Parametrlər | Settings |
| filter.all | Hamısı | All |
| filter.today | Bu gün | Today |
| filter.upcoming | Yaxın tarix | Upcoming |
| filter.completed | Tamamlanan | Completed |
| greeting.morning (05–12) | Günaydın, | Good morning, |
| greeting.afternoon (12–18) | Günortanız xeyir, | Good afternoon, |
| greeting.evening (18–05) | Axşamınız xeyir, | Good evening, |
| newTask.title | Yeni Tapşırıq | New Task |
| newTask.placeholder | Nə etmək istəyirsən? | What do you want to do? |
| field.date / time | Tarix / Vaxt | Date / Time |
| field.category | Kateqoriya | Category |
| field.priority | Prioritet | Priority |
| priority.low/med/high | Aşağı / Orta / Yüksək | Low / Medium / High |
| field.notes | Qeyd · Qeyd əlavə et... | Notes · Add a note... |
| voice.button | Səsli versiya | Voice |
| voice.listening | Dinləyirəm... | Listening... |
| voice.processing | Anlayıram... | Understanding... |
| type.task / type.event | Tapşırıq / Tədbir | Task / Event |
| action.create | Tapşırıq yarat | Create Task |
| state.overdue | Gecikmiş | Overdue |
| sync.synced / failed | Təqvimə əlavə olundu / Təqvimə göndərilmədi · Yenidən cəhd et | Added to Calendar / Not sent to Calendar · Retry |

Dates: format with the UI locale. For the calendar week strip use these exact Azerbaijani weekday labels: **B.E., Ç.A., Ç., C.A., C., Ş., B.** (Mon→Sun); English: Mon…Sun. Week starts **Monday**. Azerbaijani month names: Yanvar, Fevral, Mart, Aprel, May, İyun, İyul, Avqust, Sentyabr, Oktyabr, Noyabr, Dekabr. Use 24-hour time in AZ, 12/24 per setting in EN (default 24h).

Task titles are stored in the language I spoke them in. They are not translated when I switch UI language.

---

## 5. Core concept: Task vs Event

Every item has a `type`:

- **Task** (Tapşırıq): something to do. May have a date (deadline) but **no fixed time slot**. Lives only in the app.
- **Event** (Tədbir): has a **specific start time** (meeting, call, appointment, class, anything I must be somewhere for). Lives in the app **and is automatically created in Google Calendar**.

Rules:
- Specific clock time → event. No time → task. The AI decides first, I can flip it with a Task|Event toggle before saving and later in edit.
- Event without an end time → default duration from Settings (default 60 min).
- Both types appear together in Home lists and in the Calendar view. Events show a small calendar icon and sync status.
- Changing type later: task → event creates the Google event; event → task deletes it from Google.
- Editing an event's title/time/notes updates the Google event. Deleting an event deletes it from Google (in-app confirmation sheet, not `confirm()`).
- Marking an event "done" only affects the app.
- If Google sync fails, the item still saves locally with `sync_status = failed` and a small "Retry" badge. Never lose my input because of a sync error.

---

## 6. Voice → task pipeline (the most important feature)

### 6.1 Recording (client)
- Big glowing **"Səsli versiya / Voice"** button on the New Task screen (as in the mockup) and a mic shortcut on the FAB (long-press FAB = start voice).
- Tap to start, tap to stop. Max 60s, auto-stop on 2.5s of silence if feasible. Animated waveform + timer while recording, a Cancel (X) option.
- Use `MediaRecorder` + `getUserMedia`. Detect a supported mimeType (Safari/iOS gives `audio/mp4`, Chrome gives `audio/webm`). Must work in **iOS Safari standalone PWA** and Android Chrome.
- Do **not** rely on the browser Web Speech API: it is unreliable on iOS and weak for Azerbaijani.
- Clear permission-denied state with instructions to enable the microphone.

### 6.2 Server: `POST /api/voice`
1. Receive audio (multipart), validate size/duration, require auth.
2. **Transcribe** with a speech-to-text model that handles Azerbaijani well (default: OpenAI transcription model from env `STT_MODEL`). Pass the language hint if the voice toggle is AZ or EN; otherwise auto-detect.
3. **Parse** the transcript with an LLM into structured JSON (schema below), using strict JSON / structured output mode. Model from env `PARSE_MODEL`.
4. Return `{ transcript, detected_language, items[] }`.

Also `POST /api/parse` takes typed text and runs only step 3, so typing a full sentence into "Nə etmək istəyirsən?" also gets understood (e.g. "sabah 10-da həkim").

Wrap STT and parsing in a `AiProvider` interface (`transcribe(audio, lang?)`, `parseItems(text, context)`) with an OpenAI implementation now, so I can swap providers later by env var. API keys stay server-side only. Rate-limit both endpoints (e.g. 30 req/hour per user). Store the raw transcript on the created item (for debugging bad parses).

### 6.3 Parse output schema
```json
{
  "detected_language": "az" | "en",
  "items": [
    {
      "type": "task" | "event",
      "title": "string — short and concise, max ~6 words",
      "notes": "string | null — extra details go here, not in the title",
      "date": "YYYY-MM-DD | null",
      "start_time": "HH:mm | null",
      "end_time": "HH:mm | null",
      "duration_minutes": "number | null",
      "all_day": false,
      "priority": "low" | "medium" | "high",
      "category": "one of the user's category names | null",
      "confidence": 0.0-1.0,
      "clarification": "string | null — what is ambiguous, in the user's language"
    }
  ]
}
```

### 6.4 Parsing rules (put these in the system prompt)
- Context sent with every call: current date-time, timezone (**Asia/Baku**, from user profile), weekday, UI language, the user's category list.
- **One utterance can contain several items** ("sabah 10-da Ramizlə görüş, bir də EduPo postunu yaz" → 1 event + 1 task).
- **Titles short; details in notes.** Strip filler like "xatırlat ki", "yadıma sal", "remind me to", "I need to".
- Azerbaijani relative dates: bu gün, sabah, birigün, bu axşam, gələn həftə, gələn bazar ertəsi, həftə sonu (= Saturday), ayın sonu, "3 gündən sonra". Weekdays: bazar ertəsi, çərşənbə axşamı, çərşənbə, cümə axşamı, cümə, şənbə, bazar. A bare weekday means the next occurrence (today if still ahead).
- Azerbaijani times: "səhər 9" = 09:00, "günorta" = 12:00, "günortadan sonra 3" = 15:00, "axşam 7" = 19:00, "gecə 11" = 23:00, "saat 3-də", "3-ün yarısı" = 02:30, "4-ə 15 dəqiqə qalmış" = 03:45 (then apply part-of-day/PM logic), "yarım saat", "1 saatlıq".
- Bare hour with no part of day: 1–6 → PM (13:00–18:00), 7–11 → AM, 12 → 12:00. Lower confidence and fill `clarification` when unsure.
- Handle code-switching (Azerbaijani sentences with English words like meeting, deadline, call, presentation) and small STT spelling errors.
- Priority: "təcili", "vacib", "mütləq", "urgent", "ASAP" → high; default medium.
- Category: match my category names and obvious keywords (e.g. EduPo, TLB, agentlik, görüş/meeting). Otherwise null.
- If nothing actionable was said, return `items: []` and a clarification.

Include these as few-shot examples (assume today is Monday 2026-11-09, Asia/Baku):

1. "Sabah saat 10-da Ramizlə EduPo demo görüşü" → event, "EduPo demo — Ramiz", 2026-11-10 10:00–11:00, category EduPo
2. "Cümə gününə qədər Power BI hesabatını bitirməliyəm, təcilidir" → task, "Power BI hesabatını bitir", date 2026-11-13, high
3. "Remind me to call the bank tomorrow afternoon" → task, "Call the bank", 2026-11-10, no time (no exact slot); notes "afternoon"
4. "Çərşənbə axşamı 3-də müştəri zəngi, yarım saatlıq, sonra da TLB üçün post yazmaq" → event "Müştəri zəngi" 2026-11-10 15:00–15:30 + task "TLB postunu yaz" 2026-11-10, category TLB Academy
5. "Next Friday 7pm dinner with family" → event "Family dinner", 2026-11-20 19:00–20:00, Personal

(Note in example 5: "next Friday" on a Monday = the Friday of next week. Document this convention in the prompt; it is a common source of errors.)

### 6.5 Confirmation sheet (default ON)
After parsing, show a bottom sheet with one editable card per item: title, Task|Event toggle, date, time, category chip, priority, notes, plus the transcript in small muted text. Buttons: "Hamısını yarat / Create all", per-card remove, and "Yenidən danış / Record again". Highlight fields mentioned in `clarification`.
A Settings toggle "Təsdiqsiz birbaşa yarat / Create without confirmation" skips the sheet (then show an undo toast for 5s).

---

## 7. Google Calendar integration

- Sign-in: Google via Supabase Auth.
- Calendar access: a separate **"Connect Google Calendar"** flow in Settings using my own OAuth routes (`/api/google/connect`, `/api/google/callback`, `/api/google/disconnect`) with scope `https://www.googleapis.com/auth/calendar.events` (+ `calendar.readonly` to list calendars), `access_type=offline`, `prompt=consent`. Store the **refresh token encrypted** (AES-GCM with `TOKEN_ENCRYPTION_KEY`) in `google_connections`. Refresh access tokens server-side.
- Settings lets me pick the target calendar (default `primary`).
- Created events: title, description = notes + "Created with Swift", start/end with timezone Asia/Baku, default Google reminders. Save `google_event_id`.
- **Calendar view also shows my existing Google Calendar events** for the visible range (read-only, fetched via `/api/calendar/events?from&to`, cached briefly), visually marked as from Google. Swift-created events are not duplicated (match by `google_event_id`).
- Handle: token revoked → show "Reconnect" banner; event deleted in Google (404/410) → mark item unsynced, don't crash.

---

## 8. Screens

### Home (Ana səhifə), per mockup
- Header: avatar circle with initials, "Günaydın, İsrafil 👋" (greeting by time of day, name from profile), bell icon.
- Filter chips: Hamısı / Bu gün / Yaxın tarix / Tamamlanan.
- "Bu gün" section with date on the right ("9 Noy, B.E."). Items: round checkbox, title, colored dot + time range (or date for tasks), category chip, ⋮ menu (Edit, Change date, Make event/task, Delete).
- Overdue tasks appear at top of Today with a red "Gecikmiş" label.
- Completed items: checked blue circle, strikethrough, muted.
- Swipe right = complete, swipe left = delete (with undo toast).
- Floating **+** FAB (tap = New Task, long-press = start voice immediately).
- Quote card at the bottom (rotating daily from a local bilingual list of ~30 short original motivational lines, e.g. "Bugünkü nizam-intizam, sabahkı azadlığı yaradır." / "Discipline today creates freedom tomorrow.").
- Bell opens a sheet: overdue tasks + next upcoming events today.
- Empty state: friendly illustration-free message + "Səslə ilk tapşırığını əlavə et" button.

### New Task (Yeni Tapşırıq), per mockup
Back arrow, title, big text field "Nə etmək istəyirsən?", rows: Tarix, Vaxt, Kateqoriya, Prioritet, Qeyd (each opens a bottom-sheet picker), Task|Event toggle (auto-set to Event when a time is chosen), big glowing "Səsli versiya" button, primary "Tapşırıq yarat" button (light mockup shows it).

### Calendar (Təqvim), per mockup
Month title ("Noyabr 2026") + calendar icon to open full month grid. Horizontal week strip with weekday labels and day numbers, selected day in a filled blue circle, dots under days that have items. Below: list of that day's events and timed tasks with colored dots and time ranges, then untimed tasks for that day. Swipe the strip to change week.

### Focus (Fokus), not in mockups, design to match
Pick a task (or "free focus"), Pomodoro timer with a large circular progress ring in brand gradient, presets 25/5, 50/10, custom. Start/Pause/Reset, keeps working if the screen locks (use timestamps, not intervals). On finish: soft sound (after user interaction) + "Mark task done?" prompt. Log sessions to `focus_sessions`. Keep screen awake with Wake Lock API when available.

### Stats (Statistika)
Cards: completed today, completed this week, completion rate, current streak (days with ≥1 completion), focus minutes this week. 7-day bar chart of completed items, breakdown by category (donut or horizontal bars), tasks vs events count. Brand colors, readable in both themes.

### Settings (Parametrlər)
Profile name, UI language, voice language default, theme (System/Light/Dark), Google Calendar (connect/disconnect, target calendar, status), default event duration (30/45/60/90), time format, "create without confirmation" toggle, categories manager (add/rename/recolor/reorder/delete; names in AZ and EN), install-app instructions, export my data (JSON), sign out. App version + tagline at the bottom.

---

## 9. Data model (Supabase, RLS: user can only access own rows)

```
profiles          id (= auth uid), display_name, ui_locale, voice_locale, theme,
                  timezone default 'Asia/Baku', default_event_minutes default 60,
                  time_format, auto_create bool default false, created_at
categories        id, user_id, name_az, name_en, color, icon, sort_order
items             id, user_id, type ('task'|'event'), title, notes,
                  date, start_at timestamptz, end_at timestamptz, all_day bool,
                  priority ('low'|'medium'|'high'), category_id,
                  status ('open'|'done'), completed_at,
                  source ('voice'|'text'|'manual'), raw_transcript, language,
                  google_event_id, sync_status ('none'|'pending'|'synced'|'failed'),
                  sync_error, created_at, updated_at
google_connections user_id, google_email, refresh_token_encrypted, calendar_id,
                  connected_at, last_error
focus_sessions    id, user_id, item_id null, started_at, planned_minutes,
                  actual_minutes, completed bool
```

Seed default categories on first sign-in: İş/Work, Görüş/Meeting, Şəxsi/Personal, EduPo, TLB Academy (I can edit them later).

**Access restriction:** this is my personal app. Only emails listed in env `ALLOWED_EMAILS` can sign in; everyone else sees "This app is private." This also protects my AI API credits.

---

## 10. Environment variables

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=
OPENAI_API_KEY=
STT_MODEL=            # e.g. a current OpenAI transcription model
PARSE_MODEL=          # e.g. a small, cheap current OpenAI model with structured outputs
TOKEN_ENCRYPTION_KEY= # 32-byte base64
ALLOWED_EMAILS=isgandarov.israfil@gmail.com
APP_URL=
```
Provide `.env.example`. Never commit secrets.

---

## 11. SETUP.md (write this for me)

Step-by-step, written for a non-developer, in simple English with screenshots-free instructions:
1. Create Supabase project, run migrations, enable Google auth provider.
2. Google Cloud: create project, enable **Google Calendar API**, configure OAuth consent screen, add scopes, add redirect URIs (local + production), create OAuth client.
   **Important:** while the consent screen is in "Testing" status, Google refresh tokens expire after **7 days** and calendar sync silently stops. Explain how to switch the app to "In production" (unverified is fine for personal use; I'll click through the warning once).
3. Get an OpenAI API key, set a small monthly spending limit.
4. Deploy to Vercel, set env vars, set production redirect URIs.
5. Install on iPhone/Android as an app.

---

## 12. Quality bar

- TypeScript strict, no `any` in domain code. Zod validation for all API inputs and for the AI's JSON output (if the model returns invalid JSON, retry once, then show a friendly error and keep the transcript so I can edit it as text).
- Unit tests for: date/time helpers (Asia/Baku, Monday week start), AI output → item mapping, task/event rules. Parser tests with mocked AI responses using the few-shot examples above.
- One Playwright smoke test at 390×844 (iPhone size) in light and dark: open Home, create a task by text, complete it.
- Accessibility: visible focus states, labels on icon buttons, sufficient contrast in both themes.
- Lighthouse PWA installable, performance ≥ 90 on mobile.

---

## 13. Milestones (build in this order, commit after each, tell me when each is done)

1. **Foundation:** Next.js + Tailwind tokens + light/dark themes + i18n AZ/EN + PWA manifest/icons + app shell with bottom nav / desktop sidebar.
2. **Data & auth:** Supabase schema, RLS, Google sign-in, allowed-emails gate, seed categories.
3. **Manual tasks:** Home (filters, list, complete, swipe, edit, delete), New Task screen with pickers.
4. **Voice:** recording UI, `/api/voice`, `/api/parse`, confirmation sheet, multi-item support.
5. **Google Calendar:** connect flow, auto-create/update/delete events, sync status + retry, Calendar view with Google events.
6. **Calendar, Focus, Stats, Settings** screens.
7. **Polish:** offline shell, empty/error states, animations, tests, SETUP.md, README.

Out of scope for v1 (keep the code ready for it): Todoist sync, recurring items ("hər bazar ertəsi"), push notification reminders for tasks, sharing.

When something in this brief is unclear or conflicts with the mockups, the **mockups win for visuals** and **this brief wins for behavior**. Ask me only if a decision is expensive to reverse.
