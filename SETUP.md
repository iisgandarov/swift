# Setting up Swift

This guide takes you from zero to Swift running on your phone. You don't need to be a developer. Expect about 45 minutes.

You will create four free (or nearly free) accounts. Each one gives you some values to copy. Keep a text note open and paste every value into it as you go. At the end, those values go into Vercel.

| Service | What it does for Swift | Cost |
|---|---|---|
| **Supabase** | Database and Google sign-in | Free plan is enough |
| **Google Cloud** | Lets Swift add events to your Google Calendar | Free |
| **Google AI Studio (Gemini)** | Understands voice tasks and text tasks | Free tier |
| **Vercel** | Hosts the app on the internet | Free plan is enough |

You also need the Swift code in a **GitHub** repository. Vercel deploys from there.

---

## Your note: the values you'll collect

Copy this list into your note. Fill it in step by step.

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=
AI_PROVIDER=gemini
GEMINI_API_KEY=
GEMINI_MODEL=gemini-3.1-flash-lite
TOKEN_ENCRYPTION_KEY=
ALLOWED_EMAILS=isgandarov.israfil@gmail.com
APP_URL=
```

---

## Step 0: Pick your app address

Vercel gives every project an address like `https://swift-israfil.vercel.app`. You'll choose the name in Step 4, but several earlier steps need the address. So choose it now.

1. Pick a name, for example `swift-israfil`. Your address is then `https://swift-israfil.vercel.app`.
2. Write it in your note as `APP_URL=https://swift-israfil.vercel.app` (no slash at the end).
3. Also write `GOOGLE_REDIRECT_URI=https://swift-israfil.vercel.app/api/google/callback`.

In the rest of this guide, **YOUR-APP** means this address.

> If the name is already taken on Vercel, choose another and update every place you used it. Using your own domain is fine too.

---

## Step 1: Supabase (database and sign-in)

### 1.1 Create the project
1. Go to <https://supabase.com> and sign up (signing in with GitHub is easiest).
2. Click **New project**.
3. Name: `swift`. Database password: click **Generate** and save it in your note (you won't need it often).
4. Region: **Central EU (Frankfurt)** is the closest to Baku.
5. Click **Create new project** and wait 1–2 minutes.

### 1.2 Create the tables
1. In the left menu, open **SQL Editor**.
2. Click **New query**.
3. Open the file `supabase/migrations/0001_init.sql` from the Swift code (on GitHub, open the file and click the **Copy raw file** button).
4. Paste everything into the SQL editor and click **Run**.
5. You should see **Success. No rows returned**.

### 1.3 Copy your keys
1. Open **Project Settings** (gear icon) → **API Keys** (on some accounts this is called **API**).
2. Copy into your note:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`. You can also find it under **Project Settings → Data API**. It looks like `https://abcdefgh.supabase.co`.
   - **anon / publishable** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role / secret** key → `SUPABASE_SERVICE_ROLE_KEY`. Click **Reveal** to see it.

> ⚠️ The service_role/secret key can read everything in your database. Never share it or put it anywhere except Vercel's environment variables.

### 1.4 Set the sign-in addresses
1. Open **Authentication** → **URL Configuration**.
2. **Site URL**: `YOUR-APP` (for example `https://swift-israfil.vercel.app`).
3. Under **Redirect URLs**, click **Add URL** and add both of these:
   - `YOUR-APP/auth/callback`
   - `http://localhost:3000/auth/callback`. This one is only for running Swift on a computer; it's harmless to add.
4. Click **Save**.

Leave Supabase open. You'll come back in Step 2.6 to turn on Google sign-in.

---

## Step 2: Google Cloud (sign-in and Google Calendar)

One Google "OAuth client" is used for two things: signing in to Swift, and connecting Swift to your Google Calendar.

### 2.1 Create a project
1. Go to <https://console.cloud.google.com> and sign in with your Gmail.
2. Click the project picker at the top → **New project** → name it `Swift` → **Create**.
3. Make sure **Swift** is selected in the project picker at the top.

### 2.2 Turn on the Google Calendar API
1. In the search bar at the top, type **Google Calendar API** and open it.
2. Click **Enable**.

### 2.3 Set up the consent screen
Google has been renaming this area. It may be called **Google Auth Platform** or **OAuth consent screen**.

1. Search for **Google Auth Platform** (or **OAuth consent screen**) and open it. Click **Get started**.
2. **App information**: App name `Swift`; User support email: your Gmail.
3. **Audience**: choose **External**.
4. **Contact information**: your Gmail.
5. Accept the policy and click **Create**.

### 2.4 Add the permissions (scopes)
1. In Google Auth Platform, open **Data Access** → **Add or remove scopes**.
2. Tick, or paste into **Manually add scopes**:
   - `openid`
   - `.../auth/userinfo.email`
   - `https://www.googleapis.com/auth/calendar.events`
   - `https://www.googleapis.com/auth/calendar.readonly`
3. Click **Update**, then **Save**.

### 2.5 Create the OAuth client
1. Open **Clients** → **Create client**.
2. Application type: **Web application**. Name: `Swift web`.
3. **Authorized JavaScript origins**: add
   - `YOUR-APP`
   - `http://localhost:3000`
4. **Authorized redirect URIs**: add all three:
   - `https://YOUR-SUPABASE-PROJECT.supabase.co/auth/v1/callback`. Use your **Project URL** from Step 1.3 and add `/auth/v1/callback` to the end.
   - `YOUR-APP/api/google/callback`
   - `http://localhost:3000/api/google/callback`
5. Click **Create**.
6. Copy **Client ID** → `GOOGLE_CLIENT_ID` and **Client secret** → `GOOGLE_CLIENT_SECRET` into your note.

### 2.6 Turn on Google sign-in in Supabase
1. Back in Supabase: **Authentication** → **Sign In / Providers** → **Google**.
2. Turn it **on**. Paste the **Client ID** and **Client secret** from Step 2.5.
3. Click **Save**.

### 2.7 ⚠️ Important: publish the app ("In production")

While the consent screen is in **Testing** status, Google makes the calendar connection expire after **7 days**. Calendar sync then silently stops. Avoid this:

1. In Google Auth Platform, open **Audience**.
2. Under **Publishing status**, click **Publish app** and confirm. Status becomes **In production**.
3. Google may say the app needs verification. **You don't need it** for a personal app. Unverified apps can still be used by their owner.

The first time you connect your calendar, Google shows **"Google hasn't verified this app"**. That's expected, because you made the app yourself. Click **Advanced** → **Go to Swift (unsafe)** → **Continue**. You only do this once.

> If calendar sync ever stops anyway, Swift shows a red **"Google Calendar disconnected. Reconnect"** bar. Tap it and approve again.

---

## Step 3: Google Gemini (voice and text understanding)

Swift sends your voice note or typed sentence to Google Gemini, which writes it down and fills in the title, date, time, category and priority. One request does both.

1. Go to <https://aistudio.google.com/apikey> and sign in with your Gmail.
2. Click **Create API key**. Choose your Google Cloud project if it asks (the same "Swift" / "My First Project" is fine).
3. Copy the key (it starts with `AIza`) into your note as `GEMINI_API_KEY`.
4. Leave `AI_PROVIDER=gemini` and `GEMINI_MODEL=gemini-3.1-flash-lite` (the free-tier model). If that model is ever unavailable, Swift tries `gemini-flash-latest` and then `gemini-2.5-flash` by itself.
5. To check the setup after deploying, sign in and open `YOUR-APP/api/ai/test`. It shows whether the key is present, which model answered, and Google's exact error if something fails.

The free tier is enough for personal use. If you ever hit its limit, Swift says so and keeps your text, and you can save it as typed.

## Step 4: Deploy on Vercel

### 4.1 Make the encryption key
Swift encrypts your Google Calendar token with a secret key that only you have. You need 32 random bytes, written in base64.

- **Mac**: open the **Terminal** app, paste the command below, and press Enter:
  ```bash
  openssl rand -base64 32
  ```
- **Windows**: open **PowerShell**, paste the command below, and press Enter:
  ```bash
  [Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
  ```

Copy the result (it looks like `k3J9...=`) into `TOKEN_ENCRYPTION_KEY`.

> Keep this key. If you change it later, you'll need to reconnect Google Calendar once.

### 4.2 Create the Vercel project
1. Go to <https://vercel.com> and sign up with GitHub.
2. Click **Add New** → **Project** → choose your Swift repository → **Import**.
3. **Project name**: the name you picked in Step 0 (for example `swift-israfil`).
4. Open **Environment Variables**. Add every line from your note, one by one: name on the left, value on the right. Tip: you can paste the whole note into the first field and Vercel splits it into variables.
5. Click **Deploy** and wait about 2 minutes.
6. Open the address Vercel shows. It should be the same as `APP_URL`. If Vercel gave a different address, update `APP_URL` and `GOOGLE_REDIRECT_URI` in **Settings → Environment Variables**, update the addresses from Steps 1.4 and 2.5, then **Redeploy** (Deployments → ⋯ → Redeploy).

### 4.3 First real run (checklist)
1. Open `YOUR-APP` and tap **Continue with Google**. Sign in with `isgandarov.israfil@gmail.com`. You should land on Home with "Good morning/afternoon/evening, İsrafil".
2. (Optional) Sign in with any other Google account. You should see **"This app is private."**
3. Go to **Settings → Google Calendar → Connect Google Calendar** and approve (see Step 2.7 for the warning screen). Settings should now say **Connected as …**.
4. Tap **+** → **Voice** and say: *"Sabah saat 10-da Ramizlə EduPo demo görüşü"*. Check the card and tap **Create Task**.
5. Open Google Calendar. The event should be there tomorrow at 10:00, with "Created with Swift" in the description.
6. Delete it in Swift. It should disappear from Google Calendar too.

If something fails, see **Troubleshooting** below.

---

## Step 5: Install Swift on your phone

**iPhone**
1. Open `YOUR-APP` in **Safari** (it must be Safari).
2. Tap the **Share** button (square with an arrow) → **Add to Home Screen** → **Add**.
3. Open Swift from the home screen icon. It opens full-screen, like a normal app.
4. The first time you use voice, allow the microphone.

**Android**
1. Open `YOUR-APP` in **Chrome**.
2. Tap **⋮** → **Install app** (or **Add to Home screen**) → **Install**.

---

## Troubleshooting

| What you see | What to do |
|---|---|
| "This app is private." with your own account | Check `ALLOWED_EMAILS` in Vercel has exactly your Gmail. Separate several emails with commas. Redeploy after changing. |
| Google says **redirect_uri_mismatch** | The address in the error must be listed in Step 2.5 exactly: same `https`, no extra slash. |
| Sign-in returns to the login page | In Supabase **URL Configuration** (Step 1.4), check the Site URL and that `YOUR-APP/auth/callback` is in Redirect URLs. |
| Settings says **Google OAuth isn't configured** | One of `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `TOKEN_ENCRYPTION_KEY` is missing in Vercel. |
| Events show a red **Retry** badge | Swift saved the item, but Google refused it. Tap **Retry**. If it keeps failing, reconnect Google Calendar in Settings. |
| Calendar sync stopped after about a week | The consent screen is still in **Testing**. Do Step 2.7, then reconnect in Settings. |
| "Voice and text understanding isn't set up yet" | `GEMINI_API_KEY` is missing or wrong in Vercel, or `GEMINI_MODEL` is not a current model name. Redeploy after fixing. |
| "The AI limit is reached for now" | Gemini's free-tier limit. Wait a minute; your text is kept and can be saved as typed. |
| "Too many voice requests this hour" | Swift's own limit of 30 AI requests per hour. Wait a bit. |
| iPhone: microphone blocked | iPhone **Settings → Safari → Microphone → Allow**. For the installed app, also check **Settings → Swift** if it appears there. |

---

## Running Swift on a computer (optional, for development)

You need [Node.js](https://nodejs.org) 22 or newer.

```bash
npm install
```

```bash
npm run dev
```

Then open <http://localhost:3000>.

Without a `.env.local` file, Swift runs in **demo mode**: a fake user, sample tasks, a pretend Google Calendar and an offline voice parser. This lets you try everything without any keys. To use your real accounts locally, copy `.env.example` to `.env.local` and fill it in.
