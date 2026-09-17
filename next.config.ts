import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
import createNextIntlPlugin from "next-intl/plugin";

// Default request-config path resolution finds src/i18n/request.ts — see
// node_modules/next-intl/dist/esm/*/plugin/getNextConfig.js resolveI18nPath().
const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  // Two root layouts (src/app/(admin)/layout.tsx, src/app/[locale]/layout.tsx)
  // mean there's no single layout to compose app/not-found.tsx from — see
  // node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/not-found.md.
  experimental: {
    globalNotFound: true,
  },
  // No image transforms on the free tier (Supabase transforms are Pro-only,
  // Sharp does not run on Workers); images are already client-resized to
  // thumb/main, so serve them as-is and keep next/image only for lazy
  // loading and layout stability.
  images: { unoptimized: true },
};

initOpenNextCloudflareForDev();

export default withNextIntl(nextConfig);
