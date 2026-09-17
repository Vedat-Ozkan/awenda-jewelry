"use server";

import { env } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const GENERIC_MESSAGE = "If that address is allowed, a sign-in link has been sent.";

// Never reveals whether `email` is in admin_emails: a stranger's address
// gets the exact same message as the owner's, and no Supabase auth call is
// made for it at all — nothing is emailed and no user is created.
export async function requestMagicLink(email: string): Promise<{ message: string }> {
  const normalized = email.trim().toLowerCase();

  const { data, error } = await createAdminClient()
    .from("admin_emails")
    .select("email")
    .eq("email", normalized)
    .maybeSingle();
  if (error) throw error;
  if (!data) return { message: GENERIC_MESSAGE };

  // The server client (not the admin client) so the PKCE code verifier is
  // written to a cookie /auth/callback can read back.
  const supabase = await createClient();
  await supabase.auth.signInWithOtp({
    email: normalized,
    options: {
      emailRedirectTo: `${env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
      shouldCreateUser: true,
    },
  });

  return { message: GENERIC_MESSAGE };
}
