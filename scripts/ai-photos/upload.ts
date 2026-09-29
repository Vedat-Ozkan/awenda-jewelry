// Publishes the approved AI photos of a batch: studio shot becomes the
// design's main image, model shot goes first in the gallery, the previous main
// photo and extras follow. Nothing is deleted. Idempotent per design.
//
//   pnpm ai-photos:upload [<batch dir>]        local Supabase (.env.local)
//   pnpm ai-photos:upload:prod [<batch dir>]   production (.env.production.local)
//
// Default batch: the newest under ai-photos/batches/.
import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { getEmbeddingProvider } from "@/lib/embeddings";
import {
  BATCHES_DIR,
  createScriptClient,
  newestBatchDir,
  type Manifest,
  type ManifestDesign,
  type Supabase,
} from "./common";

// Same output as the admin pipeline (src/lib/images/resize.ts): ≤1024 px main,
// ≤400 px thumb, JPEG q85, EXIF orientation applied then stripped, no upscaling.
async function toJpeg(input: Buffer, maxEdge: number): Promise<Buffer> {
  return sharp(input)
    .rotate()
    .resize({ width: maxEdge, height: maxEdge, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer();
}

async function putJpeg(supabase: Supabase, storagePath: string, body: Buffer) {
  const { error } = await supabase.storage
    .from("photos")
    .upload(storagePath, body, { upsert: true, cacheControl: "31536000", contentType: "image/jpeg" });
  if (error) throw new Error(`upload ${storagePath}: ${error.message}`);
}

// Studio/model live under designs/<id>/ai/ — distinct from `main.jpg` and
// `extra/…` so the real photos are never overwritten.
async function uploadShot(supabase: Supabase, designId: string, kind: "studio" | "model", source: Buffer) {
  const main = await toJpeg(source, 1024);
  const thumb = await toJpeg(source, 400);
  const mainPath = `designs/${designId}/ai/${kind}-main.jpg`;
  const thumbPath = `designs/${designId}/ai/${kind}-thumb.jpg`;
  await Promise.all([putJpeg(supabase, mainPath, main), putJpeg(supabase, thumbPath, thumb)]);
  return { mainPath, thumbPath, mainBytes: main };
}

// The previous main photo is copied (download + upsert) to its own path for
// the gallery, so a later admin "replace main photo" — which rewrites
// designs/<id>/main.jpg — cannot overwrite the original.
async function copyOriginal(supabase: Supabase, designId: string, mainSource: string, thumbSource: string) {
  const mainPath = `designs/${designId}/ai/original-main.jpg`;
  const thumbPath = `designs/${designId}/ai/original-thumb.jpg`;
  for (const [from, to] of [
    [mainSource, mainPath],
    [thumbSource, thumbPath],
  ]) {
    const { data, error } = await supabase.storage.from("photos").download(from);
    if (error) throw new Error(`download ${from}: ${error.message}`);
    await putJpeg(supabase, to, Buffer.from(await data.arrayBuffer()));
  }
  return { main: mainPath, thumb: thumbPath };
}

type Result = "done" | "skipped";

async function uploadDesign(supabase: Supabase, batchDir: string, entry: ManifestDesign): Promise<Result> {
  if (!entry.approved) return "skipped";
  if (!entry.studio || !entry.model) throw new Error("approved but studio/model not both set in manifest");

  const { data: design, error } = await supabase
    .from("designs")
    .select("id, main_image_path, thumb_image_path, ai_photos_at")
    .eq("id", entry.id)
    .maybeSingle();
  if (error) throw error;
  if (!design) throw new Error("design no longer exists");
  if (design.ai_photos_at) return "skipped";
  if (!design.main_image_path) throw new Error("design has no main photo");

  const dir = path.join(batchDir, entry.slug);
  const studioSource = await readFile(path.join(dir, entry.studio));
  const modelSource = await readFile(path.join(dir, entry.model));

  // 1. Storage, then 2. embedding of the studio shot (same as /api/photos).
  const studio = await uploadShot(supabase, entry.id, "studio", studioSource);
  const model = await uploadShot(supabase, entry.id, "model", modelSource);
  const embedding = await getEmbeddingProvider().embedImage(
    studio.mainBytes.buffer.slice(
      studio.mainBytes.byteOffset,
      studio.mainBytes.byteOffset + studio.mainBytes.byteLength,
    ) as ArrayBuffer,
    "document",
  );

  // 3. Gallery: model 0, previous main 1, previous extras keep their order
  // after it. Absolute sort_orders and delete-then-insert of our own two rows
  // keep a re-run after a partial failure from duplicating or mis-ordering.
  const previousMain = await copyOriginal(
    supabase,
    entry.id,
    design.main_image_path,
    design.thumb_image_path ?? design.main_image_path,
  );
  const ours = [model.mainPath, previousMain.main];
  const { error: clearError } = await supabase
    .from("design_images")
    .delete()
    .eq("design_id", entry.id)
    .in("main_image_path", ours);
  if (clearError) throw clearError;

  const { data: extras, error: extrasError } = await supabase
    .from("design_images")
    .select("id")
    .eq("design_id", entry.id)
    .order("sort_order");
  if (extrasError) throw extrasError;
  for (const [i, extra] of extras.entries()) {
    const { error: shiftError } = await supabase
      .from("design_images")
      .update({ sort_order: i + 2 })
      .eq("id", extra.id);
    if (shiftError) throw shiftError;
  }

  const { error: insertError } = await supabase.from("design_images").insert([
    { design_id: entry.id, main_image_path: model.mainPath, thumb_image_path: model.thumbPath, sort_order: 0 },
    { design_id: entry.id, main_image_path: previousMain.main, thumb_image_path: previousMain.thumb, sort_order: 1 },
  ]);
  if (insertError) throw insertError;

  // 4. Studio becomes the main image; ai_photos_at last, so a failure above
  // leaves the design pending and the run repeatable.
  const { error: updateError } = await supabase
    .from("designs")
    .update({
      main_image_path: studio.mainPath,
      thumb_image_path: studio.thumbPath,
      embedding: JSON.stringify(embedding),
      embedded_at: new Date().toISOString(),
      ai_photos_at: new Date().toISOString(),
    })
    .eq("id", entry.id);
  if (updateError) throw updateError;

  return "done";
}

async function main() {
  const arg = process.argv.slice(2).find((a) => !a.startsWith("--"));
  const batchDir = arg ? path.resolve(arg) : await newestBatchDir();
  if (!batchDir) {
    console.error(`No batch found under ${BATCHES_DIR}. Run ai-photos:fetch first.`);
    process.exit(1);
  }

  const manifest: Manifest = JSON.parse(await readFile(path.join(batchDir, "manifest.json"), "utf8"));
  const supabase = createScriptClient();
  const target = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  console.log(`Batch: ${batchDir}\nTarget: ${target}\n`);
  if (manifest.supabaseUrl !== target) {
    console.error(`Batch was fetched from ${manifest.supabaseUrl} but the target is ${target}. Refusing to upload.`);
    process.exit(1);
  }

  let done = 0;
  let skipped = 0;
  let failed = 0;
  for (const entry of manifest.designs) {
    try {
      const result = await uploadDesign(supabase, batchDir, entry);
      if (result === "done") {
        done++;
        console.log(`  done     ${entry.slug}`);
      } else {
        skipped++;
        console.log(`  skipped  ${entry.slug} (${entry.approved ? "already has AI photos" : "not approved"})`);
      }
    } catch (error) {
      failed++;
      console.error(`  FAILED   ${entry.slug}: ${error instanceof Error ? error.message : error}`);
    }
  }

  console.log(`\n${done} uploaded, ${skipped} skipped, ${failed} failed.`);
  if (done > 0) console.log("The storefront catalog cache refreshes within a few minutes.");
  if (failed > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
