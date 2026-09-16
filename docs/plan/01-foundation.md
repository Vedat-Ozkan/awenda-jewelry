# Phase 1 — Foundation

**Goal:** A deployable, tested, empty Next.js app on Cloudflare Workers, backed by local
Supabase for development, with CI. Nothing product-specific yet.

**Branch:** `phase-1-foundation`
**Depends on:** nothing.
**Definition of done:** `pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm e2e` pass locally
and in CI; `https://<worker>.workers.dev` serves the app; keepalive cron is scheduled;
`supabase start` works and migrations apply.

---

## Steps

### 1. Initialise repository
- `git init`, default branch `main`. Create `.gitignore` (Node, Next, `.env`, `.env.*` except
  `.env.example`, `.dev.vars` (wrangler local secrets), `.wrangler/`, `supabase/.temp/`,
  `test-results/`, `playwright-report/`, `.claude/settings.local.json`).
- Add `README.md` with the one-paragraph project description from `00-overview.md §1` (case-study version comes in Phase 9).
- Keep the existing `CLAUDE.md` and `docs/plan/` as-is.
- **Verify:** `git status` clean after first commit; `.env.local` cannot be committed (test by creating one and running `git status`).

> **STOP — ask the owner:** GitHub org/user and repository name for the public repo (proposed:
> `awenda-jewelry`). Create the repo only after confirmation; push `main`.

### 2. Scaffold Next.js
- `pnpm create next-app@latest .` — TypeScript, App Router, Tailwind, ESLint, `src/` dir, import alias `@/*`. Node 22 (`.nvmrc` = `22`), `packageManager` field pinned in `package.json`.
- Add Prettier with a minimal config; add `lint`, `typecheck` (`tsc --noEmit`), `format` scripts.
- **Verify:** `pnpm dev` serves the default page; `pnpm lint && pnpm typecheck` pass.

### 3. Cloudflare deployment via OpenNext
- Install `@opennextjs/cloudflare` and `wrangler`. Follow the adapter's current docs to create
  `open-next.config.ts` and `wrangler.jsonc` (name `awenda-jewelry`, `nodejs_compat` flag,
  assets binding). Add scripts: `preview` (`opennextjs-cloudflare build && opennextjs-cloudflare preview`) and `deploy` — invoked as `pnpm run deploy` because pnpm's built-in `deploy` command shadows the bare name. The `build` script runs `wrangler types` first so the gitignored `cloudflare-env.d.ts` exists before `next build` typechecks `custom-worker.ts`.
- Add a Cron Trigger in `wrangler.jsonc`: `"triggers": { "crons": ["0 6 */3 * *"] }` — every 3 days.
- Create `src/app/api/keepalive/route.ts`: `GET`, requires header `x-cron-secret === CRON_SECRET`, returns 200. (It will query Supabase in Phase 2 step 9.) Wire the Worker `scheduled` handler (per OpenNext docs) to fetch this route with the secret.
- **Verify:** `pnpm preview` serves locally under workerd. `pnpm run deploy` publishes to `*.workers.dev` and the page loads. `wrangler deployments list` shows the cron trigger.

> **STOP — ask the owner:** Cloudflare account login. The owner must run `wrangler login`
> themselves (interactive). Do not proceed to deploy until they confirm.

### 4. Local Supabase
- `pnpm dlx supabase init` → `supabase/` folder. Requires Docker. `supabase start`.
- Add `supabase/migrations/0001_extensions.sql`: `create extension if not exists vector;` and `pgcrypto`.
- Add `src/lib/supabase/{client,server,admin}.ts`: browser client (anon), server client with cookies (`@supabase/ssr`), and a service-role client used only in route handlers/cron.
- Add `pnpm db:reset` (`supabase db reset`) and `pnpm db:types` (`supabase gen types typescript --local > src/lib/supabase/database.types.ts`).
- **Verify:** `supabase status` shows API/DB URLs; `pnpm db:reset` applies the migration; `select extname from pg_extension` includes `vector`.

### 5. Environment handling
- `.env.example` listing every variable in `00-overview.md §6` with empty values and one-line comments.
- `src/lib/env.ts`: validate server env on first access (lazy, so `next build` needs no secrets) with `zod` (fail fast with a clear message). Client-safe vars are read directly via `process.env.NEXT_PUBLIC_*`.
- For Cloudflare: document in README that production secrets are set with `wrangler secret put NAME` and non-secret vars in `wrangler.jsonc` `vars`.
- **Verify:** Starting the app with a missing required var throws a readable error naming the var.

### 6. Test tooling
- **Vitest** for unit/integration: `vitest.config.ts`, `pnpm test`. Integration tests read `API_URL`/`ANON_KEY` from `supabase status -o env` (those are the names it emits; there is no `SUPABASE_URL`).
- **Playwright**: `pnpm e2e`, `playwright.config.ts` starting `pnpm dev` with `EMBEDDINGS_PROVIDER=fake`. One smoke test: home page renders.
- **Verify:** `pnpm test` and `pnpm e2e` pass with the placeholder tests.

### 7. CI (GitHub Actions)
- `.github/workflows/ci.yml` on PR and push to `main`: checkout → pnpm install (cached) → lint → typecheck → build → `supabase start` (use `supabase/setup-cli` action) → `pnpm test` → install Playwright browsers → `pnpm e2e` → upload Playwright report on failure.
- `.github/workflows/deploy.yml` on push to `main` after CI (`workflow_run`): `pnpm run deploy` with `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` repo secrets.
- **Verify:** Open a PR with a trivial change; CI green. Merge; deploy workflow publishes.

> **STOP — ask the owner:** to add the two Cloudflare secrets to the GitHub repo (agent cannot).

### 8. Base app shell
- `src/app/layout.tsx` with metadata title "Awenda Jewelry", `lang` attribute (locale wiring comes in Phase 5), Tailwind base styles, a minimal header with the wordmark text "Awenda Jewelry".
- PWA basics: `public/manifest.webmanifest` (name, short_name, `display: standalone`, theme colour, placeholder icons 192/512), linked from layout. No service worker (offline support is out of scope).
- **Verify:** Chrome DevTools → Application → Manifest shows the manifest with no installability errors on the deployed site (Lighthouse ≥ 12 removed the PWA/"Installable" audit).

### 9. Documentation
- README: prerequisites (Node 22, pnpm, Docker), `pnpm install`, `supabase start`, `cp .env.example .env.local`, `pnpm dev`, test commands, deploy notes.
- **Verify:** A fresh clone following the README reaches a running dev server (agent performs this in a temp directory).

---

## Out of scope for this phase
Any schema beyond extensions, any UI beyond the shell, auth, i18n.
