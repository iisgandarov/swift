import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseAdmin, createSupabaseServer } from "@/lib/supabase/server";
import { env, isEmailAllowed } from "@/lib/server/env";
import { ensureUserSetup, getAppContext } from "@/lib/server/context";

/** Supabase OAuth return URL: exchanges the code, enforces ALLOWED_EMAILS, seeds the profile. */
export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;
  const code = request.nextUrl.searchParams.get("code");
  if (!code) return NextResponse.redirect(`${origin}/login?error=1`);

  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) return NextResponse.redirect(`${origin}/login?error=1`);

  if (!isEmailAllowed(data.user.email)) {
    await supabase.auth.signOut();
    // don't keep accounts of people who aren't allowed in
    if (env.supabaseServiceKey) {
      await createSupabaseAdmin().auth.admin.deleteUser(data.user.id).catch(() => undefined);
    }
    return NextResponse.redirect(`${origin}/private?email=${encodeURIComponent(data.user.email ?? "")}`);
  }

  const ctx = await getAppContext();
  if (ctx) await ensureUserSetup(ctx);
  return NextResponse.redirect(`${origin}/`);
}
