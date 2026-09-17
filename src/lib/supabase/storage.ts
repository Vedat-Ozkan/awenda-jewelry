// Public URL for a photo in the `photos` bucket (0002_core.sql — public
// bucket, admin-only writes). Reads NEXT_PUBLIC_SUPABASE_URL straight from
// process.env, not `@/lib/env`: that module is server-only, and this helper
// is used from client components (storefront, admin) as well as the server.
export function publicPhotoUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const cleanPath = path.startsWith("/") ? path.slice(1) : path;
  return `${base}/storage/v1/object/public/photos/${cleanPath}`;
}

// Seed rows point at public/seed/<slug>.svg (served as a static file, not a
// Storage object — see DECISIONS.md "Phase 2 plan drift"); everything else
// is a real photo in the `photos` Storage bucket. Same rule as the local
// `thumbSrc()` in src/app/admin/(shell)/catalog/catalog-list.tsx, exported
// here for the storefront (ProductCard) too. Returns null for a design with
// no photo yet.
export function resolvePhotoUrl(path: string | null): string | null {
  if (!path) return null;
  return path.startsWith("seed/") ? `/${path}` : publicPhotoUrl(path);
}
