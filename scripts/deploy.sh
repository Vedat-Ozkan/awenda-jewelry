#!/bin/sh
# `pnpm run deploy` (locally and in deploy.yml). NEXT_PUBLIC_* values are
# inlined at build time, and `next build` would otherwise take them from
# .env.local (localhost URLs) or leave them undefined in CI. Exporting the
# production values from wrangler.jsonc first wins over .env files.
set -eu
for key in NEXT_PUBLIC_SITE_URL NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_ANON_KEY NEXT_PUBLIC_CF_BEACON_TOKEN; do
  value=$(grep -o "\"$key\": \"[^\"]*" wrangler.jsonc | cut -d'"' -f4)
  [ -n "$value" ] || { echo "deploy: $key missing from wrangler.jsonc" >&2; exit 1; }
  export "$key=$value"
done
opennextjs-cloudflare build
opennextjs-cloudflare deploy
