import type { MetadataRoute } from "next";

// Phase 5 step 9. `force-dynamic` for the same reason as sitemap.ts — reads
// NEXT_PUBLIC_SITE_URL at request time rather than baking it into a build
// that may run without it configured.
export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/api", "/auth"] },
    sitemap: `${base}/sitemap.xml`,
  };
}
