import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "@/i18n/routing";
import { updateSession } from "@/lib/supabase/middleware";

// Next.js 16 renamed the request-interception file convention from
// middleware.ts to proxy.ts (same mechanics, exported function renamed
// middleware -> proxy) — see node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md.
const intlMiddleware = createMiddleware(routing);

// Composes two concerns behind one proxy (Next.js only allows one):
// - /admin/* keeps the Phase 4 admin guard (session check, admin allowlist).
// - /auth/* (the Supabase magic-link callback) passes through untouched —
//   it's not locale-prefixed and has no guard.
// - everything else (the storefront) goes through next-intl's middleware,
//   which redirects "/" -> "/en" and detects the locale for unprefixed paths
//   (cookie -> Accept-Language -> defaultLocale — see next-intl's routing
//   docs; localePrefix "always" means every matched path ends up prefixed).
// The matcher below excludes /api, /_next and any path with a file
// extension (static assets: /seed/*, /brand/*, manifest.webmanifest,
// favicon.ico, …), so those never reach this function at all.
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/admin")) return adminGuard(request);
  if (pathname.startsWith("/auth")) return NextResponse.next();

  return intlMiddleware(request);
}

// Guards /admin/* (Phase 4 step 1). /admin/login and, outside production,
// /admin/dev/* are exempt — the dev harness (Phase 3) has its own sign-in
// and must keep working, but only in non-production builds.
async function adminGuard(request: NextRequest) {
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
  matcher: ["/((?!api|_next|.*\\..*).*)"],
};
