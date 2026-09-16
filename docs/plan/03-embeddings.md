# Phase 3 — Images and Embeddings

**Goal:** A reusable image pipeline (browser resize → Supabase Storage) and an embeddings
module with a Voyage provider and a deterministic fake, wired to `match_designs()`.

**Branch:** `phase-3-embeddings`
**Depends on:** Phase 2.
**Definition of done:** Uploading a photo from a dev page stores main+thumb, produces an
embedding on the design row, and a booth-style photo of the same item returns that design as
rank 1 from `match_designs()` on a real Voyage call (manual check) and on the fake provider (automated).

---

## Steps

### 1. Client-side image processing (`src/lib/images/resize.ts`)
- Input: `File` from `<input type="file" accept="image/*" capture="environment">`.
- `createImageBitmap(file, { imageOrientation: 'from-image' })` (honours EXIF rotation),
  draw to canvas at ≤1024 px long edge → JPEG blob q 0.85 (`main`); ≤400 px → `thumb`.
  Strips EXIF automatically (canvas output carries none).
- Return `{ main: Blob, thumb: Blob, width, height }`.
- **Verify:** Vitest with `@vitest/browser` or a Playwright unit page: a 4000×3000 fixture
  becomes 1024×768; a portrait EXIF-rotated fixture comes out upright; output has no EXIF
  (check with `exifr`).

### 2. Embedding provider interface (`src/lib/embeddings/`)
```ts
export interface EmbeddingProvider {
  embedImage(image: Blob | ArrayBuffer, kind: 'document' | 'query'): Promise<number[]>; // length DIMS
}
export const DIMS = 1024;
```
- `voyage.ts`: calls Voyage's multimodal embeddings endpoint with the image as base64 data
  URL, `input_type` = kind. Read the current Voyage docs for the exact request shape and the
  newest stable multimodal model; **if its dimension is not 1024, stop and update
  `DECISIONS.md` Open #12 and the `vector(1024)` columns in a new migration before continuing.**
  Timeout 20 s, one retry on 5xx/429.
- `fake.ts`: deterministic — hash the image bytes into a seeded PRNG, generate a unit vector.
  Additionally, if the bytes contain a marker string `AWENDA_FAKE_KEY=<k>` (used by test
  fixtures), derive the vector from `<k>` only, so two different "photos" of the same test item
  match exactly. Document this in the file header.
- `index.ts`: picks by `EMBEDDINGS_PROVIDER` (`voyage` | `fake`).
- **Verify:** unit tests — fake provider is deterministic, unit-norm, DIMS long; two fixtures with the same key are identical; voyage provider is exercised once manually (`pnpm tsx scripts/embed-check.ts path/to.jpg` prints length 1024).

### 3. Upload + embed route (`src/app/api/photos/route.ts`, admin-only)
- Multipart: `main`, `thumb`, `target` = `design:<id>` | `booth:<id>`.
- Uses service client: upload both blobs to bucket `photos` at the Phase 2 path scheme
  (`upsert: true`, `cacheControl: '31536000'`), compute embedding from `main`
  (`document` for designs, `query` for booth), update the target row's paths, `embedding`,
  `embedded_at`.
- Auth: must be an admin session (helper `requireAdmin()` from `src/lib/auth.ts` — create it
  here; full login UI comes in Phase 4, tests use a signed-in test user created via the admin API).
- **Verify:** integration test uploads two fixtures with the same fake key to a design and a
  booth sale; `match_designs(booth.embedding)` returns that design at rank 1 with distance ≈ 0.

### 4. `match_designs` wrapper (`src/lib/embeddings/search.ts`)
- `findCandidates(boothSaleId, k = 3)` → calls RPC with the booth sale's embedding and category filter, joins design name/thumb/variants, returns `[{design, distance, rank}]`.
- Category filter is applied first; if fewer than `k` results, fall back to no category filter and mark those candidates `crossCategory: true`.
- **Verify:** integration test with seed data: same-category preference; fallback path exercised.

### 5. Dev harness page (`/admin/dev/embed`, only when `NODE_ENV !== 'production'`)
- Upload a photo as "catalog", upload another as "booth", show top-3 with distances.
- **Verify (manual, owner or agent with a real key):** photograph one real item twice on the
  gray tray; rank 1 is correct. Record the distance in `DECISIONS.md` as a baseline.

### 6. Storage URL helper
- `publicPhotoUrl(path)` → Supabase public URL; used by storefront and admin.
- **Verify:** unit test.

---

## Notes for agents
- Photos must be taken on the matte light-gray tray; the UI copy in Phase 4/7 reminds the user.
- Never send the `thumb` to Voyage; always `main`.
- Keep Voyage calls server-side only (`VOYAGE_API_KEY` is secret).
- The fake provider must make e2e tests fully offline.
