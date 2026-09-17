import type { MetadataRoute } from "next";
import { CATEGORIES, getDesigns } from "@/lib/catalog";

// Phase 5 step 9. `force-dynamic` (rather than the default cached route
// handler behaviour — see node_modules/next/dist/docs/.../sitemap.md
// "cached by default unless it uses a Request-time API") so this always
// runs at request time against the live catalog, never during `next
// build` — the build has no Supabase available (see src/app/[locale]/
// layout.tsx's own note on the same constraint). Confirmed dynamic (ƒ) in
// `pnpm build`'s route list.
export const dynamic = "force-dynamic";

const STATIC_PATHS = ["", "/about", "/pickup", "/policies", ...CATEGORIES.map((category) => `/c/${category}`)];

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

// One <url> entry per locale (not one entry with alternates only) — Google's
// multi-regional sitemap guidance wants every language URL listed on its
// own, each annotated with the full alternates set (itself included).
function localizedEntries(path: string, base: string, lastModified?: Date): MetadataRoute.Sitemap {
  const en = `${base}/en${path}`;
  const fr = `${base}/fr${path}`;
  const alternates = { languages: { en, fr } };
  return [
    { url: en, alternates, lastModified },
    { url: fr, alternates, lastModified },
  ];
}

// All non-draft designs (public_designs already excludes drafts) plus
// home/category/static pages, both locales (Phase 5 step 9).
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();

  const entries: MetadataRoute.Sitemap = STATIC_PATHS.flatMap((path) => localizedEntries(path, base));

  const designs = await getDesigns({ sort: "newest" });
  for (const design of designs) {
    entries.push(...localizedEntries(`/p/${design.slug}`, base, new Date(design.created_at)));
  }

  return entries;
}
