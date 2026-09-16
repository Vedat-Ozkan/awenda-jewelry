# Phase 5 — Storefront (EN/FR)

**Goal:** A fast, bilingual public catalog with product pages, a client-side cart, sold-out
handling with "similar styles", and solid SEO. Checkout itself is Phase 6.

**Branch:** `phase-5-storefront`
**Depends on:** Phase 3 (images/search) and Phase 4 seed/catalog data. Can run in parallel with Phase 4 once Phase 3 is merged.
**Definition of done:** `/en` and `/fr` render catalog + product pages from the DB; cart
persists in `localStorage`; sold-out designs appear greyed with similar styles; Lighthouse
mobile performance ≥ 90 on the catalog page; e2e covers browsing, language switch, cart.

> **STOP — ask the owner** before step 1: logo files and brand colours (Open #10).
> Before step 8: market-day oversell banner (Open #14).

---

## Steps

### 1. i18n scaffold
- `next-intl` with `src/app/[locale]/…`, `middleware.ts` locale detection (cookie → Accept-Language → `en`), locales `en`, `fr`. Messages in `messages/en.json`, `messages/fr.json`.
- `<LanguageSwitcher>` in header; `hreflang` alternates in metadata.
- **Verify:** `/` redirects by header; `/fr` shows French chrome; switching keeps the same page.

### 2. Data access for storefront (`src/lib/catalog/`)
- Server-only queries via anon client against `public_designs` / `public_settings`.
- `getDesigns({ category?, sort })`, `getDesignBySlug(slug, locale)` returning localized name/description with EN fallback, `getSimilar(designId, k=4)` via `match_designs` using the design's own embedding (exclude itself, prefer in-stock).
- Cache: Next `revalidate = 60` for lists; product page `revalidate = 60`; tag-based `revalidateTag('catalog')` called from admin mutations (Phase 4 server actions — add the call there in this PR).
- **Verify:** unit tests for fallback logic; integration test for `getSimilar` excluding self.

### 3. Design system
- Tailwind theme with brand tokens from the owner's logo colours; system font stack or one Google Font (owner choice — default: none, system stack).
- Components: `ProductCard`, `Price` (USD, `Intl.NumberFormat` per locale), `Badge` (Sold out / Épuisé), `Button`, `Header`, `Footer` (market info, language switch, policy links).
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

### 8. Market-day notice (if approved in Open #14)
- During market hours on market day, show a dismissible banner: "Orders placed during market hours are confirmed by email this evening."
- **Verify:** unit test for the time-window predicate; e2e with a mocked clock.

### 9. SEO and performance
- `sitemap.ts` (all active + archived product URLs, both locales), `robots.ts`, canonical + hreflang, Open Graph images (main photo).
- `next/image` with a custom loader that returns the Supabase URL as-is for `main`/`thumb` (no on-the-fly transforms available). Provide `sizes` so the browser picks `thumb` in grids and `main` on product pages.
- Cloudflare Web Analytics snippet (free, cookieless) — placed but token supplied in Phase 9.
- **Verify:** Lighthouse mobile on catalog and product pages: Performance ≥ 90, SEO ≥ 95. Fix the top issues if under.

### 10. Error and empty states
- Empty category, 404 product, DB unreachable (friendly message, still shows market info from a static fallback).
- **Verify:** e2e for 404; manual for DB outage (stop Supabase, page shows fallback).

---

## Out of scope
Payments, accounts, wishlists, reviews, search (category tabs are enough at this catalog size — add search only if the owner asks).
