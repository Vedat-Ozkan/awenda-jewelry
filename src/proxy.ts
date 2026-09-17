import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// Next.js 16 renamed the request-interception file convention from
// middleware.ts to proxy.ts (same mechanics, exported function renamed
// middleware -> proxy) — see node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md.
//
// Guards /admin/* (Phase 4 step 1). /admin/login and, outside production,
// /admin/dev/* are exempt — the dev harness (Phase 3) has its own sign-in
// and must keep working, but only in non-production builds.
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/admin/login") return NextResponse.next();
  if (process.env.NODE_ENV !== "production" && pathname.startsWith("/admin/dev")) {
    return NextResponse.next();
  }

  const { user, supabase, isAdmin, getResponse } = await updateSession(request);

  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/login";
    url.search = `?next=${encodeURIComponent(pathname)}`;
    return copyCookies(getResponse(), NextResponse.redirect(url));
  }

  if (!isAdmin) {
    await supabase.auth.signOut();
    const url = request.nextUrl.clone();
    url.pathname = "/admin/login";
    url.search = "?error=notallowed";
    return copyCookies(getResponse(), NextResponse.redirect(url));
  }

  return getResponse();
}

// NextResponse.redirect() creates a fresh Response, so any Set-Cookie
// headers already staged on `from` (session refresh, or a signOut() the
// caller made) must be copied onto it explicitly.
function copyCookies(from: NextResponse, to: NextResponse): NextResponse {
  for (const cookie of from.cookies.getAll()) {
    to.cookies.set(cookie);
  }
  return to;
}

export const config = {
  matcher: "/admin/:path*",
};
