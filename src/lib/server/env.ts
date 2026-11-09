import "server-only";

/** Server-side env access. Values are read lazily so a missing key only breaks the feature that needs it. */
export const env = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  // Vercel's Supabase integration may provide the newer "publishable"/"secret" key names
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "",
  supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || "",
  googleClientId: process.env.GOOGLE_CLIENT_ID ?? "",
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
  googleRedirectUri: process.env.GOOGLE_REDIRECT_URI ?? "",
  openaiKey: process.env.OPENAI_API_KEY ?? "",
  aiProvider: process.env.AI_PROVIDER ?? "",
  sttModel: process.env.STT_MODEL ?? "",
  parseModel: process.env.PARSE_MODEL ?? "",
  tokenKey: process.env.TOKEN_ENCRYPTION_KEY ?? "",
  allowedEmails: (process.env.ALLOWED_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean),
  appUrl: process.env.APP_URL ?? "",
};

/**
 * Demo mode: no Supabase configured. Uses an in-memory store and a fake user so the
 * app can be developed and tested without any keys. Never enabled in production
 * unless SWIFT_DEMO=1 is set explicitly (used by the e2e smoke test).
 */
export function isDemoMode() {
  if (env.supabaseUrl) return false;
  return process.env.NODE_ENV !== "production" || process.env.SWIFT_DEMO === "1";
}

export function isEmailAllowed(email: string | null | undefined) {
  if (!email) return false;
  return env.allowedEmails.includes(email.toLowerCase());
}

export function googleConfigured() {
  return Boolean(env.googleClientId && env.googleClientSecret && env.googleRedirectUri && env.tokenKey);
}
