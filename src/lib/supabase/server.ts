import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Server client, anon key, RLS enforced. Use in server components/route
// handlers. Create a new instance per request — never share across requests.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component; middleware handles the refresh.
          }
        },
      },
    },
  );
}
