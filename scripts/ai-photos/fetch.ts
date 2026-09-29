// Downloads the real photos of every design that has no AI photos yet into
// ai-photos/batches/<YYYY-MM-DD-HHmm>/<slug>/ and writes manifest.json.
//
//   pnpm ai-photos:fetch [--limit N]        local Supabase (.env.local)
//   pnpm ai-photos:fetch:prod [--limit N]   production (.env.production.local)
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { BATCHES_DIR, createScriptClient, type Manifest, type ManifestDesign, type Supabase } from "./common";
import { findPendingDesigns } from "./pending";

function parseLimit(argv: string[]): number {
  const i = argv.indexOf("--limit");
  if (i === -1) return 10;
  const n = Number(argv[i + 1]);
  if (!Number.isInteger(n) || n < 1) {
    console.error("--limit needs a positive integer");
    process.exit(1);
  }
  return n;
}

function batchName(now: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}-${p(now.getHours())}${p(now.getMinutes())}`;
}

async function download(supabase: Supabase, storagePath: string, dest: string) {
  const { data, error } = await supabase.storage.from("photos").download(storagePath);
  if (error) throw new Error(`download ${storagePath}: ${error.message}`);
  await writeFile(dest, Buffer.from(await data.arrayBuffer()));
}

async function main() {
  const limit = parseLimit(process.argv.slice(2));
  const supabase = createScriptClient();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;

  const pending = await findPendingDesigns(supabase, limit);
  if (pending.length === 0) {
    console.log(`Nothing pending on ${supabaseUrl}: every design already has AI photos (or no real photos).`);
    return;
  }

  const now = new Date();
  const batchDir = path.join(BATCHES_DIR, batchName(now));
  const designs: ManifestDesign[] = [];

  for (const design of pending) {
    const dir = path.join(batchDir, design.slug);
    await mkdir(dir, { recursive: true });

    const { data: extras, error } = await supabase
      .from("design_images")
      .select("main_image_path")
      .eq("design_id", design.id)
      .order("sort_order");
    if (error) throw error;

    const sources = [design.main_image_path!, ...extras.map((e) => e.main_image_path)];
    const photos: string[] = [];
    for (const [i, source] of sources.entries()) {
      const name = `real-${i + 1}${path.extname(source) || ".jpg"}`;
      await download(supabase, source, path.join(dir, name));
      photos.push(name);
    }

    designs.push({
      id: design.id,
      slug: design.slug,
      name: design.name_en,
      category: design.category,
      metal: design.metal,
      photos,
      studio: null,
      model: null,
      approved: false,
      note: null,
    });
    console.log(`  ${design.slug} (${design.category}, ${design.metal}): ${photos.length} photo(s)`);
  }

  const manifest: Manifest = { createdAt: now.toISOString(), supabaseUrl, designs };
  await writeFile(path.join(batchDir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");

  console.log(`\nFetched ${designs.length} design(s) from ${supabaseUrl}`);
  console.log(`Batch: ${batchDir}`);
}

// Async function, not top-level await: tsx transpiles to CJS here.
main().catch((error) => {
  console.error(error);
  process.exit(1);
});
