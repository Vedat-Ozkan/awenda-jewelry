---
name: ai-photos
description: Generate AI studio + model photos for designs that don't have them yet, using Codex CLI (ChatGPT login, no API key), check each against the real photos, get the owner's approval, and upload. Usage: /ai-photos [prod] [limit]
---

Run the AI product-photo batch (plan `docs/plan/10-ai-photos.md`, decision "AI product photos via Codex" in `docs/plan/DECISIONS.md`). Arguments: **$ARGUMENTS**

- `prod` present → use the `:prod` scripts (`pnpm ai-photos:fetch:prod`, `pnpm ai-photos:upload:prod`, target = production, env from `.env.production.local`). Otherwise the local scripts against local Supabase. These touch production data, so the owner may have to approve the commands. Never read `.env*` files.
- A number → `--limit N` for fetch (default 10). Image turns are expensive against the ChatGPT Plus limits, so keep batches small.

## 1. Fetch
`pnpm ai-photos:fetch [--limit N]` (or `:prod`). It prints the batch folder `ai-photos/batches/<YYYY-MM-DD-HHmm>/` and writes `manifest.json` (one entry per design: `slug`, `category`, `metal`, `photos`, `studio`, `model`, `approved`, `note`). "Nothing pending" → tell the owner and stop.

## 2. Generate (per design, two Codex runs)
Run from the design folder `<batch>/<slug>/`. Exact shape (the `--` before the prompt is required, otherwise `-i` swallows it):

```
codex exec --skip-git-repo-check -s workspace-write -i real-1.jpg -i real-2.jpg -- "<prompt>"
```

Pass every real photo of that design with `-i`. Each prompt must end with: `Save the final image into the current directory as studio.png.` (or `model.png`) — Codex's `image_gen` output lands in its own folder, so it has to copy it in. Run designs one at a time (usage limits); a design's two runs may be sequential.

**Studio prompt** (all categories):
> Product photo of this exact piece of jewelry ({category}, {metal words: stainless steel / sterling silver}). Clean matte ivory / off-white backdrop, soft even studio light, a subtle soft shadow, the piece centred, square framing. Do not change the jewelry in any way: same shape, links, stones, clasp, colour and proportions. Remove background clutter, hands and props from the reference photo. Save the final image into the current directory as studio.png.

**Model prompt** — same opening ("this exact piece of jewelry"), then the pose by category:

| category | pose |
|---|---|
| necklace, pendant, chain | neckline / collarbone crop, worn on the neck, no face |
| ring | a hand, ring on the finger |
| earring | ear in profile, earring worn |
| bracelet, bangle | a wrist |
| anklet | an ankle |

> ...Worn by a model: {pose}. Neutral light-grey background, plain simple clothing, no other jewelry at all. The piece must be identical to the reference photos (shape, link type, stones, clasp, metal colour, size relative to the body). Natural skin, correct anatomy. Save the final image into the current directory as model.png.

After each successful run set `studio` / `model` in `manifest.json` to `"studio.png"` / `"model.png"`. No file produced → treat as a failed attempt.

## 3. QA (Read the png files yourself)
Open the real photos and the generated image and check: overall shape; chain or link type; stones (count, cut, colour); clasp or closure; steel vs silver colour (silver is not gold, steel is not yellow); scale and proportions; extra or missing jewelry; warped anatomy (fingers, ears, neck); text or watermarks. Any drift → regenerate that image with a prompt naming the specific error. **At most 2 retries per image.** Still off → leave that design's `studio`/`model` null, put the reason in `note`, and skip the design.

## 4. Owner approval
For each design that passed QA, show the owner the real photo, the studio shot and the model shot (Read the files so they render) with the design name, and ask approve or reject. Do not batch-approve without showing the images. Set `"approved": true` in `manifest.json` only for designs the owner approved.

## 5. Upload and report
`pnpm ai-photos:upload <batch dir>` (or `:prod`; the batch folder defaults to the newest). It resizes to 1024/400 px JPEG, makes the studio shot the main image, puts the model shot first in the gallery followed by the original photos (nothing deleted), re-embeds, and sets `ai_photos_at`. Idempotent: rerun is safe. Report per design what went live, which were skipped (and why), and any failures; on failure fix the cause and rerun. Production storefront cache refreshes within a few minutes.
