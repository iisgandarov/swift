import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { getAppContext } from "@/lib/server/context";
import { googleConfigured } from "@/lib/server/env";
import { signState } from "@/lib/google/crypto";
import { buildAuthUrl } from "@/lib/google/oauth";

const NONCE_COOKIE = "swift_g_nonce";

/** Starts the "Connect Google Calendar" flow (separate from sign-in; asks for calendar scopes + offline access). */
export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;
  const ctx = await getAppContext();
  if (!ctx) return NextResponse.redirect(`${origin}/login`);

  if (ctx.demo) {
    await ctx.repo.saveGoogleConnection({
      google_email: "demo@gmail.com",
      refresh_token_encrypted: "demo",
      calendar_id: "primary",
      last_error: null,
      needs_reconnect: false,
    });
    return NextResponse.redirect(`${origin}/settings?google=connected`);
  }
  if (!googleConfigured()) return NextResponse.redirect(`${origin}/settings?google=not_configured`);

  const nonce = randomBytes(16).toString("base64url");
  (await cookies()).set(NONCE_COOKIE, nonce, { httpOnly: true, secure: true, sameSite: "lax", path: "/api/google", maxAge: 600 });
  const state = signState({ uid: ctx.user.id, nonce, ts: Date.now() });
  return NextResponse.redirect(buildAuthUrl(state));
}
