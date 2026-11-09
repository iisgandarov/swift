import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/server/env";

export async function POST(request: NextRequest) {
  if (!isDemoMode()) {
    const supabase = await createSupabaseServer();
    await supabase.auth.signOut();
  }
  return NextResponse.redirect(`${request.nextUrl.origin}/login`, { status: 303 });
}
