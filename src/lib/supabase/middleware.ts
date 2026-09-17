import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Supabase SSR "Server-Side Auth for Next.js" middleware pattern, adapted
// for proxy.ts (Next.js 16 renamed middleware.ts -> proxy.ts, same
// mechanics). Refreshes the session, writing any renewed (or, after a later
// supabase.auth.signOut() call, cleared) cookies. `getResponse()` reads the
// response at call time rather than returning a snapshot, so it reflects
// cookie changes from a signOut() the caller makes after this returns.
// `isAdmin` is checked with the service client (same approach as
// checkAdmin() in src/lib/auth.ts) — one round trip, RLS bypassed.
export async function updateSession(request: NextRequest): Promise<{
  user: User | null;
  supabase: SupabaseClient;
  isAdmin: boolean;
  getResponse: () => NextResponse;
}> {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let isAdmin = false;
  if (user?.email) {
    const { data } = await createAdminClient()
      .from("admin_emails")
      .select("email")
      .eq("email", user.email.toLowerCase())
      .maybeSingle();
    isAdmin = Boolean(data);
  }

  return { user, supabase, isAdmin, getResponse: () => response };
}
