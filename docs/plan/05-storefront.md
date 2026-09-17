# Phase 5 — Storefront (EN/FR)

**Goal:** A fast, bilingual public catalog with product pages, a client-side cart, sold-out
handling with "similar styles", and solid SEO. Checkout itself is Phase 6.

**Branch:** `phase-5-storefront`
**Depends on:** Phase 3 (images/search) and Phase 4 seed/catalog data. Can run in parallel with Phase 4 once Phase 3 is merged.
**Definition of done:** `/en` and `/fr` render catalog + product pages from the DB; cart
persists in `localStorage`; sold-out designs appear greyed with similar styles; Lighthouse
mobile performance ≥ 90 on the catalog page; e2e covers browsing, language switch, cart.

> ~~STOP — ask the owner~~ **Resolved 2026-09-17:** placeholder wordmark + neutral gold palette, one
> Google serif for headings (DECISIONS.md "Storefront brand"). Logo files still to come (Open #10).

---

## Steps

### 1. i18n scaffold
- `next-intl` with `src/app/[locale]/…`, locale detection in `src/proxy.ts` (Next 16 name for middleware) (cookie → Accept-Language → `en`), locales `en`, `fr`. Messages in `messages/en.json`, `messages/fr.json`.
- `<LanguageSwitcher>` in header; `hreflang` alternates in metadata.
- **Verify:** `/` redirects by header; `/fr` shows French chrome; switching keeps the same page.

### 2. Data access for storefront (`src/lib/catalog/`)
- Server-only queries via anon client against `public_designs` / `public_settings`.
- `getDesigns({ category?, sort })`, `getDesignBySlug(slug, locale)` returning localized name/description with EN fallback, `getSimilar(designId, k=4)` via `match_designs` using the design's own embedding (exclude itself, prefer in-stock).
- Cache: routes are `force-dynamic` (builds have no DB); data via `unstable_cache` tag `catalog`, 60 s; `revalidateTag('catalog', …)` called from admin mutations and `/api/photos`.
- **Verify:** unit tests for fallback logic; integration test for `getSimilar` excluding self.

### 3. Design system
- References (DECISIONS.md "Storefront design references"): Luzzo for home-page structure and feel, Nazzar and Mejuri for the product page (gallery, size selector + size guide, specs block, trust row). Minimalist, white space, warm gold/neutral accent, clean sans-serif; our own touches so it reads as inspired, not copied.
- Tailwind theme tokens: ivory background, near-black text, warm gold accent (placeholders until the logo arrives); headings in one Google serif via `next/font` (`display: swap`), body system sans.
- Components: `ProductCard`, `Price` (CAD, `Intl.NumberFormat` with `en-CA`/`fr-CA`), `Badge` (Sold out / Épuisé), `Button`, `Header`, `Footer` (market info, language switch, policy links).
- Place logo in `public/brand/` (SVG preferred), favicon + PWA icons from it.
- **Verify:** visual check on 390 px and 1280 px; no horizontal scroll.

### 4. Catalog page (`/[locale]`, `/[locale]/c/[category]`)
- Grid of `ProductCard`s (thumb, name, price, sold-out badge). Category tabs. Sort: newest / price.
- Sold-out designs: rendered last within their sort group, image at 60% opacity, badge, still clickable.
- Header strip: **"Next pickup: <date> at <market_name>"** or the closed-note if `market_closed_until` is in the future.
- **Verify:** e2e — categories filter; sold-out card has the badge and appears after in-stock ones.

### 5. Product page (`/[locale]/p/[slug]`)
- Main image (from `main` path) + extra images gallery; name, price, description; variant picker
  showing only variants with `qty_on_hand > 0` (others shown disabled with "Sold out").
- Add-to-cart with quantity limited to `qty_on_hand`.
- If **all variants are 0**: hide the picker, show "Sold out — similar styles" section (`getSimilar`).
- Always show "similar styles" at the bottom (4 cards).
- 301 from `previous_slugs`.
- JSON-LD `Product` schema with `offers.availability`.
- **Verify:** e2e — variant picker excludes 0-qty; sold-out design shows similar styles; old slug redirects.

### 6. Cart (client)
- `localStorage` cart `{ variantId, qty }[]` with a Zustand or context store; header badge count.
- `/[locale]/cart`: line items with current name/price/qty re-fetched from server (never trust stored price), remove/update, subtotal, **fulfillment radio: Pick up at market (free) / Ship (flat rate)** — the Ship option only appears when `settings.shipping_enabled`. Shows free-shipping progress if threshold set.
- "Checkout" button posts to the route built in Phase 6 (stub returns 501 for now, e2e asserts the button exists).
- If a line's variant no longer has stock, mark it and block checkout until removed.
- **Verify:** e2e — add two items, reload, cart persists; setting variant qty to 0 in DB marks the line unavailable.

### 7. Static pages
- `/[locale]/about` (parents' story — placeholder copy, owner supplies text in Phase 9), `/[locale]/pickup` (market info + `pickup_instructions`), `/[locale]/policies` (shipping/returns/privacy — placeholder until Open #4).
- **Verify:** pages render in both locales.

### 8. ~~Market-day notice~~ — dropped 2026-09-16 (separate online stock; Open #14 moot). Sold-out product pages get a **"Notify me when back in stock"** email form in Phase 7; leave a clear slot for it here.

### 9. SEO and performance
- `sitemap.ts` (all active + archived product URLs, both locales), `robots.ts`, canonical + hreflang, Open Graph images (main photo).
- `next/image` with `images.unoptimized = true` (no transforms on the free tier); components choose `thumb` in grids and `main` on product pages themselves.
- (Cloudflare Web Analytics snippet moved to Phase 7.)
- **Verify:** Lighthouse mobile on catalog and product pages: Performance ≥ 90, SEO ≥ 95. Fix the top issues if under.

### 10. Error and empty states
- Empty category, 404 product, DB unreachable (friendly message, still shows market info from a static fallback).
- **Verify:** e2e for 404; manual for DB outage (stop Supabase, page shows fallback).

---

## Out of scope
Payments, accounts, wishlists, reviews, search (category tabs are enough at this catalog size — add search only if the owner asks).
