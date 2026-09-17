# Phase 6 — Checkout, Orders, and Emails

**Goal:** Customers pay with Stripe Checkout choosing Ship or Pickup; a signed webhook creates
the order and decrements inventory atomically; customers get bilingual emails; the owner
manages orders (ship with tracking, refund).

**Branch:** `phase-6-checkout`
**Depends on:** Phases 4 and 5.
**Definition of done:** e2e: cart → Checkout creates a Stripe session (test mode) with the
correct line items and fulfillment; a simulated signed `checkout.session.completed` event
creates the order, decrements stock, sends an email (captured); insufficient stock triggers
auto-refund path; admin can mark shipped/picked up/refund.

> **STOP — ask the owner** before step 1: Stripe account exists and test keys available?
> (The business owner must create the Stripe account — needs EIN/SSN and bank details.)
> Before step 2: shipping rate/threshold in CAD, Canada-only (Open #3), Stripe Tax / GST-HST (Open #2),
> decrement timing (Open #7).

---

## Steps

### 1. Stripe setup
- `stripe` SDK with `httpClient: Stripe.createFetchHttpClient()` (required on Workers).
  `src/lib/stripe.ts`. Webhook signature via `stripe.webhooks.constructEventAsync` (Web Crypto).
- Local: `stripe listen --forward-to localhost:3000/api/stripe/webhook`; document in README.
- **Verify:** `pnpm tsx scripts/stripe-check.ts` lists the account in test mode.

### 2. Create Checkout Session (`POST /api/checkout`)
- Input: cart lines `{variantId, qty}[]`, `fulfillment: 'ship'|'pickup'`, `locale`.
- Server re-validates: variant exists, design active, `qty ≤ qty_on_hand`, price from DB.
  Reject with a localized error listing unavailable lines.
- Build session:
  - `mode: 'payment'`, `line_items` with `price_data` (`currency: 'cad'`, `unit_amount`, `product_data.name` =
    localized name + variant label, `images: [main url]`), `quantity`.
  - `metadata`: `fulfillment`, `locale`, and a compact JSON of `[{variantId, qty}]` (≤ 500 chars; if
    larger, store a `checkout_drafts` row and put its id in metadata — implement only if needed).
  - `locale` → Stripe's `fr` / `en`.
  - **pickup**: no address collection; `custom_text.submit` = pickup message with next market date.
  - **ship**: `shipping_address_collection.allowed_countries: ['CA']`, one `shipping_options`
    entry with `shipping_rate_data` flat amount, or amount 0 named "Free shipping" when
    subtotal ≥ threshold.
  - `automatic_tax.enabled` = `settings.stripe_tax_enabled`.
  - `phone_number_collection.enabled: true` (useful for pickups).
  - `success_url` `/[locale]/order/{CHECKOUT_SESSION_ID}`; `cancel_url` back to cart.
  - `expires_at` = now + 30 min (Stripe minimum).
- Return `{ url }`; client redirects.
- **Verify:** unit tests for the session-builder (pure function producing the params) covering
  pickup vs ship, free-shipping threshold, tax flag, locale; integration test hits Stripe test API and asserts the session's line items.

### 3. Webhook (`POST /api/stripe/webhook`)
- Verify signature; handle `checkout.session.completed` (and `checkout.session.async_payment_succeeded` for delayed methods; `…_failed` → no-op log).
- Idempotent: `orders.stripe_checkout_session_id` unique; on conflict return 200.
- In one Postgres transaction (via a `create_order_from_checkout(jsonb)` SQL function to keep it atomic):
  1. Insert `orders` (status `awaiting_pickup` or `awaiting_shipment`), `order_items` with snapshots.
  2. For each item call `adjust_inventory(variant, -qty, 'online_order', order.id)`.
  3. If any raises `insufficient_stock`: mark that `order_items.fulfilled = false`, continue others.
- After commit: if any item unfulfilled → create a **partial refund** via Stripe for those lines
  (and shipping if nothing fulfilled), set status `refunded` when nothing fulfilled, and send the
  "item sold out — refunded" email; else send confirmation email.
- Always respond 200 within 10 s; email/refund failures are logged and retried by an admin "resend" button, never block the webhook.
- **Verify:** integration tests posting events signed with `stripe.webhooks.generateTestHeaderString`:
  normal order; duplicate delivery (one order); one line out of stock (partial refund called — Stripe client mocked at the boundary); concurrent webhooks for the last unit (exactly one fulfilled).

### 4. Order confirmation page (`/[locale]/order/[sessionId]`)
- Reads the order by session id (public but unguessable id; show no address, only last-4 of nothing — keep it to items, totals, fulfillment instructions). Polls briefly if the webhook has not landed yet ("Confirming your payment…").
- Pickup: shows market name, address, next date, `pickup_instructions`. Ship: "You'll get a tracking email."
- **Verify:** e2e after simulated webhook shows items and instructions in FR and EN.

### 5. Emails (Resend, `src/lib/email/`)
- React Email templates, EN/FR: `order-confirmation`, `pickup-reminder` (sent the day before the market — cron, step 8), `shipped` (with tracking), `refund-notice`.
- `EMAIL_FROM` from env; in dev/test use a capture: `RESEND_API_KEY` unset → write emails to `tmp/emails/*.html` and expose a test helper to read them.
- **Verify:** snapshot tests render both locales; e2e reads the captured confirmation.

### 6. Orders admin (`/admin/orders`)
- List with status filters; badges for pickup vs ship; search by email/name. A **Pickups** filter/tab with a one-tap **Picked up** action (this replaces the deferred booth tab; the owner is the one at the market with the order).
- Detail: items, customer, address, Stripe links (`https://dashboard.stripe.com/test/payments/<pi>`), movement ledger entries.
- Actions: **Mark shipped** (tracking number + carrier select → builds `tracking_url`; sends `shipped` email), **Mark picked up**, **Refund** (full or per line; calls Stripe, `adjust_inventory(+qty,'refund')` for refunded lines, sends `refund-notice`), **Resend email**.
- **Verify:** e2e: mark shipped sends email with tracking; refund restores qty and writes a `refund` movement.

### 7. Cart → Checkout wiring
- Replace the Phase 5 stub; handle validation errors by marking lines.
- **Verify:** e2e clicks Checkout and asserts a redirect to `checkout.stripe.com` (do not drive Stripe's hosted page in CI; a separate manual test script `docs/manual-tests.md` covers the 4242 card path end-to-end in test mode).

### 8. Pickup reminder cron
- Cloudflare cron daily 09:00 local: for `awaiting_pickup` orders, if tomorrow is the next market date and no reminder sent, send `pickup-reminder`; store `reminder_sent_at`. Reuses the keepalive scheduled handler pattern with a second cron expression.
- **Verify:** integration test of the selection query; manual trigger route in dev.

### 9. Settings integration
- `shipping_enabled` off → Ship option absent from cart and rejected by `/api/checkout`.
- **Verify:** e2e toggles the setting and checks both.

---

## Out of scope
Customer accounts, discount codes, gift cards, live carrier rates, international shipping, label purchase (owner uses Pirate Ship manually and pastes tracking).
