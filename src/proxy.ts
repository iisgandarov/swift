import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const PUBLIC_PREFIXES = ["/login", "/private", "/auth/", "/icons/", "/sounds/", "/_next/", "/sw.js", "/manifest.webmanifest", "/favicon"];

function isPublic(pathname: string) {
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p));
}

function allowedEmails() {
  return (process.env.ALLOWED_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Refreshes the Supabase session cookie on every request and gates the app:
 * signed-out → /login, signed-in but not in ALLOWED_EMAILS → /private.
 * In demo mode (no Supabase configured) everything passes through.
 */
export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return NextResponse.next();

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list, headers) => {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers ?? {}).forEach(([k, v]) => response.headers.set(k, v));
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const email = typeof data?.claims?.email === "string" ? data.claims.email.toLowerCase() : null;
  const { pathname } = request.nextUrl;

  if (isPublic(pathname)) return response;

  const isApi = pathname.startsWith("/api/");
  if (!data?.claims) {
    if (isApi) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const login = request.nextUrl.clone();
    login.pathname = "/login";
    login.search = "";
    return NextResponse.redirect(login);
  }
  if (!email || !allowedEmails().includes(email)) {
    if (isApi) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    const priv = request.nextUrl.clone();
    priv.pathname = "/private";
    priv.search = email ? `?email=${encodeURIComponent(email)}` : "";
    return NextResponse.redirect(priv);
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|icons/|sounds/|sw.js|manifest.webmanifest|favicon).*)"],
};
