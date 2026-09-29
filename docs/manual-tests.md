# Manual tests

Checks that need a real Stripe test key and can't run in CI. The owner runs these once a
Stripe test account exists (`STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET`/
`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` set in `.env.local` — see README "Stripe (local)").

## Checkout end to end (4242 test card)

1. `pnpm supabase start`, then `pnpm dev`.
2. In another terminal: `stripe listen --forward-to localhost:3000/api/stripe/webhook` — copy the
   printed `whsec_...` into `STRIPE_WEBHOOK_SECRET` and restart `pnpm dev`.
3. Add an in-stock design to the cart at `/en/cart`, pick **Ship** or **Pick up at market**,
   click **Checkout**.
4. On Stripe's hosted page, pay with the test card `4242 4242 4242 4242`, any future expiry,
   any CVC, any postal code.
5. Stripe redirects to `/en/order/{session id}` — it should show "Confirming your payment…"
   briefly, then the order's items, totals, and (for pickup) the market/pickup instructions or
   (for ship) the tracking-email note.
6. Check the `stripe listen` terminal: it should show `checkout.session.completed` delivered
   with a `200` response.
7. Check the DB: the ordered variant's `qty_on_hand` decremented by the quantity bought, and a
   row was added to `orders`/`order_items`/`inventory_movements`.
8. Check email: with `RESEND_API_KEY` unset, the confirmation is captured to
   `tmp/emails/*.html` — open the newest file in a browser. With `RESEND_API_KEY` set, check the
   inbox for the email used at checkout.
9. Re-run `stripe trigger checkout.session.completed` or resend the same webhook event from the
   Stripe dashboard to confirm duplicate delivery doesn't create a second order or send a second
   email (`orders.stripe_checkout_session_id` is unique).

## Failed auto-refund (sold out at payment time)

If the webhook could not refund an oversold line (Stripe error), the order stays
`awaiting_pickup` / `awaiting_shipment` with that line marked "Sold out — refunded" but **no money
returned** and no customer email. It shows up only in the Worker logs
(`console.error` with the order id and session id). To resolve: refund the payment in the Stripe
dashboard, then use **Resend email → refund** on the order. `Refund` in the admin will say
"Nothing to refund" because the line is already unfulfilled.
