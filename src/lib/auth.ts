import type { User } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

function unauthorized(): Response {
  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: { "content-type": "application/json" },
  });
}

function forbidden(): Response {
  return new Response(JSON.stringify({ error: "Forbidden" }), {
    status: 403,
    headers: { "content-type": "application/json" },
  });
}

// Shared membership check: 401 if not signed in, 403 if signed in but not in
// admin_emails (checked with the service client, which bypasses RLS).
async function checkAdmin(user: User | null): Promise<{ user: User; email: string }> {
  if (!user?.email) throw unauthorized();
  const email = user.email.toLowerCase();

  const { data, error } = await createAdminClient()
    .from("admin_emails")
    .select("email")
    .eq("email", email)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw forbidden();

  return { user, email };
}

// Admin auth for route handlers (Phase 3 step 3). Auth source, in order: an
// `Authorization: Bearer <jwt>` header (tests, future API callers), else the
// cookie session via createClient() (src/lib/supabase/server.ts). Throws a
// Response (401/403) rather than returning one — callers `catch` it, e.g.
// src/app/api/photos/route.ts.
export async function requireAdmin(request: Request): Promise<{ user: User; email: string }> {
  const supabase = await createClient();
  const bearer = request.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
  const { data } = bearer ? await supabase.auth.getUser(bearer) : await supabase.auth.getUser();
  return checkAdmin(data.user);
}

// Same check for server actions, which have no Request to read a header
// from — reads the cookie session directly.
export async function requireAdminFromCookies(): Promise<{ user: User; email: string }> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return checkAdmin(data.user);
}
