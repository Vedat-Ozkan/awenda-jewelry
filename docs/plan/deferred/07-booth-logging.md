# Phase 7 — Booth Mode

> **DEFERRED (2026-09-16):** the store launches with **separate online stock**, so there is no
> booth logging or reconciliation. This file is kept for the day stock is merged; when that
> happens it must be redrafted around **SKU tags** (see `DECISIONS.md` "Separate online stock at
> launch; booth integration deferred"), not photo matching. Do not implement.

**Goal:** At the market, on a phone, the owner logs a sale in under 10 seconds and hands over
online pickups with one tap. No catalog lookup during the day.

**Branch:** `phase-7-booth`
**Depends on:** Phases 4 and 6.
**Definition of done:** e2e logs a sale (photo → category → variant → submit) creating a
`booth_sales` row with an embedding; Pickups tab lists `awaiting_pickup` orders and marks one
picked up; "Sold online today" list shows items bought online since the last reconciliation.

---

## Steps

### 1. Booth layout (`/admin/booth`)
- Two top tabs: **Log sale** (default) and **Pickups**. Large touch targets (≥ 56 px), high contrast for outdoor use, minimal text.
- Persistent small banner at the top: **"Sold online today: N"** → expands to a list (thumb, name, variant) of `order_items` from orders created since the last reconciliation run (`max(booth_sales.reconciled_at)` or start of today, whichever is earlier). Purpose: pull those pieces off the display.
- **Verify:** renders at 390 px; banner count matches seeded orders.

### 2. Log sale flow — one screen, three taps
1. Tap the big camera button → native camera (`capture="environment"`). Photo is resized
   client-side (Phase 3) and previewed as a thumbnail. Copy: "Gray tray, then shoot."
2. Category row (5 buttons, remembers last used).
3. Variant chips from `settings.variant_presets[category]` plus "Other" (free text). For
   `earring` the chip is auto-selected ("One size").
4. Optional price paid (defaults blank).
5. **Submit** → inserts `booth_sales` (status `pending`), uploads photos to `booth/<date>/…`,
   embeds with kind `query` (photo route with `target=booth:<id>`). Optimistic UI: the form
   clears immediately, a small "Saved (3 today)" toast appears; failures show a retry chip in a
   "Not saved" strip that persists until resolved (no offline queue — plain retry).
- **Verify:** e2e: full flow produces a row with photo paths and fake embedding; failure path
  (photo route mocked to 500) shows retry, retry succeeds.

### 3. Today's log
- Below the form: list of today's booth sales (thumb, category, variant, time) with **Undo**
  (deletes the row and photos if still `pending`).
- **Verify:** e2e undo removes the row.

### 4. Pickups tab
- List of `awaiting_pickup` orders: customer name, items (thumb + variant), total. Search box (name/email).
- **Picked up** button → sets `picked_up_at`, status `picked_up`. No inventory change (already decremented at purchase). Confirm dialog only if the order is > 2 weeks old.
- Sub-section "Not collected (past markets)" for orders older than one market cycle, with a hint to contact the customer.
- **Verify:** e2e marks an order picked up; it disappears from the list; status updated.

### 5. Guard rails
- If the owner tries to log a sale whose category+variant matches an item in the "Sold online today" list, show a non-blocking hint: "Is this an online pickup? → Pickups tab" (heuristic only; the reconciliation step is the real safety net).
- **Verify:** unit test for the hint predicate.

### 6. Reconcile shortcut
- Footer button "Reconcile N pending" → `/admin/reconcile` (Phase 8).
- **Verify:** link present with correct count.

---

## Out of scope
Offline support, card payments at the booth (owner uses their existing card reader), price editing in this view.
