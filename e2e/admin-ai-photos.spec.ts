import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { expect, test } from "./fixtures";
import { createServiceClient, getSupabaseEnv } from "../tests/helpers/local-supabase";

// Phase 10 §4: run scripts/ai-photos/upload.ts against local Supabase with
// fixture studio/model images, then check the storefront gallery order.
const FIXTURES = path.join(__dirname, "..", "tests", "fixtures");
const supabase = createServiceClient();

const slug = `e2e-ai-photos-${randomBytes(3).toString("hex")}`;
const NAME = "E2E AI Photos";
let designId = "";
let batchDir = "";
const storagePaths: string[] = [];

function runUpload() {
  const { API_URL, SERVICE_ROLE_KEY } = getSupabaseEnv();
  // Typed loosely: cloudflare-env.d.ts narrows process.env to literal values.
  const env: Record<string, string | undefined> = {
    ...process.env,
    NEXT_PUBLIC_SUPABASE_URL: API_URL,
    SUPABASE_SERVICE_ROLE_KEY: SERVICE_ROLE_KEY,
    EMBEDDINGS_PROVIDER: "fake",
  };
  return execFileSync("pnpm", ["exec", "tsx", "scripts/ai-photos/upload.ts", batchDir], {
    encoding: "utf8",
    env: env as NodeJS.ProcessEnv,
  });
}

async function putPhoto(storagePath: string, fixture: string) {
  const { error } = await supabase.storage
    .from("photos")
    .upload(storagePath, readFileSync(path.join(FIXTURES, fixture)), { upsert: true, contentType: "image/jpeg" });
  if (error) throw error;
  storagePaths.push(storagePath);
}

test.describe("AI product photos upload", () => {
  test.beforeAll(async () => {
    const { data: design, error } = await supabase
      .from("designs")
      .insert({
        slug,
        category: "necklace",
        name_en: NAME,
        price_cents: 4500,
        status: "active",
      })
      .select("id")
      .single();
    if (error) throw error;
    designId = design.id;

    // Real photos: a main photo plus one extra, as the admin pipeline stores them.
    await putPhoto(`designs/${designId}/main.jpg`, "landscape-4000x3000.jpg");
    await putPhoto(`designs/${designId}/thumb.jpg`, "portrait-exif-rotated.jpg");
    await putPhoto(`designs/${designId}/extra/0-real-main.jpg`, "portrait-exif-rotated.jpg");
    await putPhoto(`designs/${designId}/extra/0-real-thumb.jpg`, "portrait-exif-rotated.jpg");
    await supabase
      .from("designs")
      .update({ main_image_path: `designs/${designId}/main.jpg`, thumb_image_path: `designs/${designId}/thumb.jpg` })
      .eq("id", designId);
    await supabase.from("design_images").insert({
      design_id: designId,
      main_image_path: `designs/${designId}/extra/0-real-main.jpg`,
      thumb_image_path: `designs/${designId}/extra/0-real-thumb.jpg`,
      sort_order: 0,
    });
    await supabase.from("variants").insert({ design_id: designId, label: '18"', qty_on_hand: 1 });

    batchDir = mkdtempSync(path.join(os.tmpdir(), "ai-photos-e2e-"));
    const dir = path.join(batchDir, slug);
    mkdirSync(dir, { recursive: true });
    copyFileSync(path.join(FIXTURES, "ai-studio.png"), path.join(dir, "studio.png"));
    copyFileSync(path.join(FIXTURES, "ai-model.png"), path.join(dir, "model.png"));
    writeFileSync(
      path.join(batchDir, "manifest.json"),
      JSON.stringify({
        createdAt: new Date().toISOString(),
        supabaseUrl: getSupabaseEnv().API_URL,
        designs: [
          {
            id: designId,
            slug,
            name: NAME,
            category: "necklace",
            metal: "stainless_steel",
            photos: ["real-1.jpg"],
            studio: "studio.png",
            model: "model.png",
            approved: true,
            note: null,
          },
        ],
      }),
    );
  });

  test.afterAll(async () => {
    const { data: files } = await supabase.storage.from("photos").list(`designs/${designId}/ai`);
    const aiPaths = (files ?? []).map((f) => `designs/${designId}/ai/${f.name}`);
    await supabase.storage.from("photos").remove([...storagePaths, ...aiPaths]);
    await supabase.from("variants").delete().eq("design_id", designId);
    await supabase.from("designs").delete().eq("id", designId);
    if (batchDir) rmSync(batchDir, { recursive: true, force: true });
  });

  test("studio is main, model is second, real photos follow; rerun is a no-op", async ({ page }) => {
    const output = runUpload();
    expect(output).toContain("1 uploaded, 0 skipped, 0 failed");

    const { data: design } = await supabase
      .from("designs")
      .select("main_image_path, thumb_image_path, ai_photos_at, embedded_at")
      .eq("id", designId)
      .single();
    expect(design!.main_image_path).toBe(`designs/${designId}/ai/studio-main.jpg`);
    expect(design!.thumb_image_path).toBe(`designs/${designId}/ai/studio-thumb.jpg`);
    expect(design!.ai_photos_at).not.toBeNull();
    expect(design!.embedded_at).not.toBeNull();

    const { data: images } = await supabase
      .from("design_images")
      .select("main_image_path, sort_order")
      .eq("design_id", designId)
      .order("sort_order");
    expect(images!.map((i) => [i.sort_order, i.main_image_path])).toEqual([
      [0, `designs/${designId}/ai/model-main.jpg`],
      [1, `designs/${designId}/ai/original-main.jpg`],
      [2, `designs/${designId}/extra/0-real-main.jpg`],
    ]);

    // Same output as the admin pipeline: JPEG, ≤1024 main, ≤400 thumb.
    for (const [file, max] of [
      ["studio-main.jpg", 1024],
      ["studio-thumb.jpg", 400],
      ["model-main.jpg", 1024],
      ["model-thumb.jpg", 400],
    ] as const) {
      const { data, error } = await supabase.storage.from("photos").download(`designs/${designId}/ai/${file}`);
      expect(error).toBeNull();
      const meta = await sharp(Buffer.from(await data!.arrayBuffer())).metadata();
      expect(meta.format).toBe("jpeg");
      expect(Math.max(meta.width!, meta.height!)).toBeLessThanOrEqual(max);
    }

    // Storefront gallery: studio, model, original main, original extra.
    await page.goto(`/en/p/${slug}`);
    const mainImage = page.locator(`img[alt="${NAME}"]`).first();
    const expectSrc = async (fragment: string) =>
      expect(decodeURIComponent((await mainImage.getAttribute("src")) ?? "")).toContain(fragment);
    await expect(async () => expectSrc(`designs/${designId}/ai/studio-main.jpg`)).toPass();

    await page.getByRole("button", { name: `${NAME} 2` }).click();
    await expect(async () => expectSrc(`designs/${designId}/ai/model-main.jpg`)).toPass();
    await page.getByRole("button", { name: `${NAME} 3` }).click();
    await expect(async () => expectSrc(`designs/${designId}/ai/original-main.jpg`)).toPass();
    await page.getByRole("button", { name: `${NAME} 4` }).click();
    await expect(async () => expectSrc(`designs/${designId}/extra/0-real-main.jpg`)).toPass();

    // The gallery original is a copy: overwriting designs/<id>/main.jpg (what
    // the admin "replace main photo" does) leaves it intact.
    const original = await supabase.storage.from("photos").download(`designs/${designId}/ai/original-main.jpg`);
    const originalBytes = Buffer.from(await original.data!.arrayBuffer());
    await putPhoto(`designs/${designId}/main.jpg`, "portrait-exif-rotated.jpg");
    const after = await supabase.storage.from("photos").download(`designs/${designId}/ai/original-main.jpg`);
    expect(Buffer.from(await after.data!.arrayBuffer()).equals(originalBytes)).toBe(true);

    // Idempotent: a second run skips the design and changes nothing.
    const again = runUpload();
    expect(again).toContain("0 uploaded, 1 skipped, 0 failed");
    const { count } = await supabase
      .from("design_images")
      .select("id", { count: "exact", head: true })
      .eq("design_id", designId);
    expect(count).toBe(3);
  });
});
