# Phase 8 — Reconciliation

> **DEFERRED (2026-09-16):** the store launches with **separate online stock**, so there is no
> booth logging or reconciliation. This file is kept for the day stock is merged; when that
> happens it must be redrafted around **SKU tags** (see `DECISIONS.md` "Separate online stock at
> launch; booth integration deferred"), not photo matching. Do not implement.

**Goal:** In the evening the owner walks through the day's booth photos; for each, the system
proposes the top-5 catalog matches and the owner confirms with one tap. Confirming decrements
inventory. Conflicts with online orders are surfaced and resolved (refund). The confirmed
candidate's rank is recorded to measure real matching accuracy.

**Branch:** `phase-8-reconcile`
**Depends on:** Phase 7.
**Definition of done:** e2e reconciles three pending booth sales (rank-1 confirm, rank-3
confirm, manual search), one oversell produces a refund flow, and `/admin/reconcile/stats`
shows top-1/top-5 hit rates.

---

## Steps

### 1. Candidate generation
- `POST /api/reconcile/candidates` for a set of booth sale ids (default: all `pending`):
  for each, `findCandidates(id, 3)` (Phase 3 step 4), store into `booth_sales.candidates`
  with distances. Re-computing is allowed (button "Refresh matches").
- Candidate rows carry, per design, the variants and their `qty_on_hand`, and whether a variant with the tapped label exists.
- **Verify:** integration test: candidates stored; the tapped-label variant is flagged.

### 2. Reconcile UI (`/admin/reconcile`)
- Card per pending booth sale, oldest first: booth photo large; below it three candidate tiles
  (thumb, name, variant label + stock, distance shown as a subtle "confidence" bar). Best match
  visually first.
- Pre-selected variant = the label tapped at the booth; if that label doesn't exist on the
  chosen design, show the design's variants to pick from (and offer "Add variant '<label>' to
  this design" which creates it with qty 0 before decrementing — keeps data honest).
- Buttons: **Confirm** on a tile; **Search catalog…** (name search → pick → confirm, `matched_rank = null`); **No match / new item** (status `unmatched`, keeps photo for later cataloging); **Skip** (stays pending).
- Keyboard: 1/2/3 to confirm the nth tile, S to search, N for no match (owner is a developer; cheap win).
- **Verify:** e2e confirms rank 1 and rank 3, uses search for one; statuses and `matched_rank` correct.

### 3. Confirm transaction (`confirm_booth_sale(booth_sale_id, variant_id, rank)` SQL function)
- Atomic: `adjust_inventory(variant, -1, 'booth_sale', booth_sale.id)`; set `matched_variant_id`,
  `matched_rank`, `status = 'matched'`, `reconciled_at`.
- If `insufficient_stock` (qty already 0): set `status = 'oversold'`, store the intended variant, and return a structured error; the UI opens the oversell panel (step 4).
- **Undo** (within the session): `adjust_inventory(+1, 'reconcile_undo')`, status back to `pending`.
- **Verify:** integration tests: success path, oversold path, undo path, ledger rows.

### 4. Oversell resolution panel
- Shows which online order(s) hold that variant (`order_items` with `fulfilled = true`, orders not yet `picked_up`/`shipped`), newest first.
- Actions: **Refund online order line** (Phase 6 refund logic — restores qty, then auto-retries the booth confirm) or **Keep online order, mark booth sale unmatched** (owner decides the booth item was actually a different design).
- Copy explains the choice in one sentence.
- **Verify:** e2e: seed an online order for the last unit, log a booth sale for it, confirm → oversell panel → refund → booth sale becomes `matched`, order line refunded, customer refund email captured.

### 5. Batch summary
- After the last pending card: summary — matched N (top-1: a, top-2: b, top-3–5: c, search: d), unmatched M, oversold resolved K, with a list of designs that just hit 0 stock (so the owner can decide to restock/archive).
- **Verify:** e2e summary numbers.

### 6. Accuracy stats (`/admin/reconcile/stats`)
- Aggregates over `booth_sales` where `status = 'matched'`: top-1 hit rate, top-5 hit rate, search rate; by month. Also mean distance of confirmed matches vs rejected candidates (useful for the README case study).
- **Verify:** SQL view `reconcile_stats` + unit test on a seeded set.

### 7. Unmatched follow-up
- `/admin/reconcile/unmatched`: photos with "Create design from this photo" (prefills the Phase 4 new-design flow with the booth photo as main image and the tapped variant at qty 0 — because it was sold) and "Discard".
- **Verify:** e2e creates a design from an unmatched sale; sale becomes `matched` to the new design's variant with rank null and qty stays 0 (movement `catalog` +0 is skipped; document why in code with one line).

---

## Rules that must hold (enforce in tests)
- No booth sale ever changes inventory without an explicit confirm tap.
- A confirmed booth sale produces exactly one `booth_sale` movement of −1.
- Undo produces exactly one `reconcile_undo` movement of +1 and only while the sale is `matched`.
- Oversell never leaves inventory negative and never silently drops either sale.
