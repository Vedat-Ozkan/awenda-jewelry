import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Supabase "Server-Side Auth for Next.js" callback route. Handles both link
// shapes a magic-link email can produce: the PKCE `?code=` flow
// (exchangeCodeForSession) and the token-hash `?token_hash=&type=` flow
// (verifyOtp) — see requestMagicLink() in src/app/admin/login/actions.ts.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  // Only same-origin paths: reject absolute URLs and protocol-relative "//host".
  const rawNext = url.searchParams.get("next") ?? "";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/admin";

  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, url.origin));
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (!error) return NextResponse.redirect(new URL(next, url.origin));
  }

  return NextResponse.redirect(new URL("/admin/login?error=1", url.origin));
}
