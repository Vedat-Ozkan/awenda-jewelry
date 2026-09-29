# Phase 10 — AI product photos (local batch via Codex)

**Goal:** A manual batch the owner runs a few times a week in Claude Code (`/ai-photos`). For every
design that has real photos but no AI photos yet, it generates a cleaned-up **studio shot** and a
**model shot** with Codex CLI (ChatGPT Plus login, built-in `image_gen`, no API key). Claude checks
each result against the real photos, the owner approves in the session, and the approved images
are uploaded.

**Definition of done:** `pnpm ai-photos:fetch` downloads pending designs, the skill generates and
checks images, `pnpm ai-photos:upload` publishes approved ones. The storefront gallery order is:
studio (main), model, then the real photos. E2E covers the upload result on the product page.

Decisions: DECISIONS.md "AI product photos via Codex" (2026-09-29).

---

## 1. Data (migration `0015_ai_photos.sql`)
- `designs.ai_photos_at timestamptz` (null = pending). No view/RLS change needed (admin-only
  field; not exposed in `public_designs`).
- A design is **pending** when `ai_photos_at is null`, `status <> 'archived'`, and its
  `main_image_path` is a real Storage photo (not a `seed/` placeholder).

## 2. Scripts (`scripts/ai-photos/`, run with `tsx`)
Both take the target from the env file: `--env-file=.env.local` (default, local Supabase) or
`.env.production.local` (owner-created; `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
`VOYAGE_API_KEY`, `EMBEDDINGS_PROVIDER=voyage`). Package scripts:
`ai-photos:fetch`, `ai-photos:upload`, `ai-photos:fetch:prod`, `ai-photos:upload:prod`.

- **fetch** — lists pending designs (limit via `--limit`, default 10), downloads the main photo and
  extra photos into `ai-photos/batches/<YYYY-MM-DD-HHmm>/<slug>/` (gitignored) and writes a
  `manifest.json` per batch: `createdAt`, `supabaseUrl`, and per design: id, slug, name, category,
  metal, `photos` (real file names, main first), `studio`/`model` (null until generated),
  `approved` (false), `note` (null; why a design was skipped).
- **upload** — for each design in a batch with `approved: true` and both images present:
  1. Resize each generated image to main (≤1024 px) + thumb (≤400 px) JPEG (q85, same as the admin
     pipeline; done with `sharp`, a devDependency used only by this script) and upload to the
     `photos` bucket at `designs/<id>/ai/{studio,model}-{main,thumb}.jpg`. (Not `main.jpg`: the
     `/api/photos` path would overwrite the real main photo, which must stay as a gallery image.)
     The previous main photo is copied to `designs/<id>/ai/original-{main,thumb}.jpg` and the
     gallery row points at the copy, so a later admin "replace main photo" (which rewrites
     `designs/<id>/main.jpg`) cannot clobber the gallery original.
  2. Studio → the design's main image; embed it with the configured provider (same as
     `/api/photos`) so "similar styles" stays correct.
  3. Gallery (`design_images.sort_order`): model shot 0, previous main photo (the copy) 1, previous extra
     photos after it (order kept). Nothing is deleted.
  4. Set `ai_photos_at = now()` (last, so a partial failure leaves the design pending and the
     rerun repeatable; gallery rows are rewritten with absolute `sort_order`s). Idempotent: a design
     already done is skipped. Refuses to run if the manifest's `supabaseUrl` differs from the
     target (a local batch cannot be uploaded to prod).
  Prints a summary; exits non-zero if any design failed (others still processed).

## 3. Skill `.claude/skills/ai-photos/SKILL.md` (`/ai-photos [prod] [limit]`)
1. Run fetch. Nothing pending → say so and stop.
2. Per design, run Codex twice from the design folder:
   `codex exec --skip-git-repo-check -s workspace-write -i <real photo(s)> -- "<prompt>"`
   (the `--` is required; tell Codex to copy the output into the folder as `studio.png` /
   `model.png`).
   - Studio: same piece, clean matte ivory/off-white backdrop, soft even light, subtle shadow,
     centred, square; the jewelry must not change.
   - Model: category pose — necklace/pendant/chain: neckline crop; ring: hand; earring: ear in
     profile; bracelet/bangle: wrist; anklet: ankle. Neutral light-grey background, plain
     clothing, no other jewelry; the piece must be identical (shape, links, stones, metal colour).
3. Claude compares each output with the real photos (shape, chain/link type, stones, clasp,
   steel vs silver colour, scale, extra/missing jewelry, warped anatomy). Drift → regenerate, at
   most 2 retries per image; still off → mark the design skipped.
4. Show the owner each design's real photo + studio + model; the owner approves or rejects per
   design. Write `approved` into the manifest.
5. Run upload for the approved designs; report what went live.

## 4. Tests
- Integration (`tests/integration/ai-photos-pending.test.ts`): pending query includes active and
  draft designs; excludes archived, seed placeholders, no-photo and already-done designs.
- E2E (`e2e/admin-ai-photos.spec.ts`): seed a design with a real fixture photo, run the upload script against local Supabase with
  fixture studio/model images, then the product page shows studio as the main image, model as the
  second gallery image, and the original photo after it.

## 5. Owner setup (once)
- Create `.env.production.local` (never committed) with the four variables above.
- Codex CLI logged in with ChatGPT (`codex login status`).
