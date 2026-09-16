// Public URL for a photo in the `photos` bucket (0002_core.sql — public
// bucket, admin-only writes). Reads NEXT_PUBLIC_SUPABASE_URL straight from
// process.env, not `@/lib/env`: that module is server-only, and this helper
// is used from client components (storefront, admin) as well as the server.
export function publicPhotoUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const cleanPath = path.startsWith("/") ? path.slice(1) : path;
  return `${base}/storage/v1/object/public/photos/${cleanPath}`;
}
