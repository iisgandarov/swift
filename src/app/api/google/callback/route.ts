import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { getAppContext } from "@/lib/server/context";
import { encryptToken, verifyState } from "@/lib/google/crypto";
import { exchangeCode } from "@/lib/google/oauth";
import { forgetAccessToken } from "@/lib/google/client";

const NONCE_COOKIE = "swift_g_nonce";
const MAX_AGE_MS = 10 * 60 * 1000;

export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;
  const back = (status: string) => NextResponse.redirect(`${origin}/settings?google=${status}`);
  const ctx = await getAppContext();
  if (!ctx) return NextResponse.redirect(`${origin}/login`);

  const params = request.nextUrl.searchParams;
  if (params.get("error")) return back("denied");
  const code = params.get("code");
  const state = verifyState<{ uid: string; nonce: string; ts: number }>(params.get("state") ?? "");
  const jar = await cookies();
  const nonce = jar.get(NONCE_COOKIE)?.value;
  jar.delete({ name: NONCE_COOKIE, path: "/api/google" });

  if (!code || !state || state.uid !== ctx.user.id || !nonce || state.nonce !== nonce || Date.now() - state.ts > MAX_AGE_MS) {
    return back("invalid_state");
  }

  try {
    const tokens = await exchangeCode(code);
    if (!tokens.refresh_token) return back("no_refresh_token");
    const existing = await ctx.repo.getGoogleConnection();
    await ctx.repo.saveGoogleConnection({
      google_email: tokens.email,
      refresh_token_encrypted: encryptToken(tokens.refresh_token),
      calendar_id: existing?.calendar_id ?? "primary",
      last_error: null,
      needs_reconnect: false,
    });
    forgetAccessToken(ctx.user.id);
    return back("connected");
  } catch (err) {
    console.error("[google callback]", err);
    return back("error");
  }
}
