import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getEmbeddingProvider } from "@/lib/embeddings";
import { createAdminClient } from "@/lib/supabase/admin";

const MAX_FILE_BYTES = 5 * 1024 * 1024;
// Case-insensitive on the UUID only — "design"/"booth" stay literal so the
// captured `kind` can be compared with `===` below.
const UUID = "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}";
const TARGET_RE = new RegExp(`^(design|booth):(${UUID})$`);
const UPLOAD_OPTIONS = { upsert: true, cacheControl: "31536000", contentType: "image/jpeg" };

type SupabaseAdmin = ReturnType<typeof createAdminClient>;

async function uploadPhotos(supabase: SupabaseAdmin, mainPath: string, thumbPath: string, main: Blob, thumb: Blob) {
  const [mainUpload, thumbUpload] = await Promise.all([
    supabase.storage.from("photos").upload(mainPath, main, UPLOAD_OPTIONS),
    supabase.storage.from("photos").upload(thumbPath, thumb, UPLOAD_OPTIONS),
  ]);
  if (mainUpload.error) throw mainUpload.error;
  if (thumbUpload.error) throw thumbUpload.error;
}

// Admin-only upload + embed (Phase 3 step 3): stores `main`/`thumb` in the
// `photos` bucket at the Phase 2 path scheme, embeds `main`, and writes the
// paths + embedding onto the target design/booth_sales row.
export async function POST(request: Request) {
  try {
    await requireAdmin(request);
  } catch (response) {
    if (response instanceof Response) return response;
    throw response;
  }

  // Reject oversized requests before buffering the body into formData().
  // Two files under MAX_FILE_BYTES plus multipart overhead never exceeds
  // 2x the per-file cap.
  const contentLengthHeader = request.headers.get("content-length");
  if (contentLengthHeader && Number(contentLengthHeader) > MAX_FILE_BYTES * 2) {
    return NextResponse.json({ error: "Request body too large" }, { status: 413 });
  }

  const form = await request.formData();
  const main = form.get("main");
  const thumb = form.get("thumb");
  const target = form.get("target");

  if (!(main instanceof Blob) || !(thumb instanceof Blob) || typeof target !== "string") {
    return NextResponse.json({ error: "main, thumb, and target are required" }, { status: 400 });
  }
  if (main.size > MAX_FILE_BYTES || thumb.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: "Files must be 5 MB or smaller" }, { status: 400 });
  }

  const match = target.match(TARGET_RE);
  if (!match) {
    return NextResponse.json({ error: "target must be design:<uuid> or booth:<uuid>" }, { status: 400 });
  }
  const [, kind, id] = match;

  const supabase = createAdminClient();
  const mainBytes = await main.arrayBuffer();

  if (kind === "design") {
    const { data: design, error: designError } = await supabase
      .from("designs")
      .select("id")
      .eq("id", id)
      .maybeSingle();
    if (designError) throw designError;
    if (!design) return NextResponse.json({ error: "Design not found" }, { status: 404 });

    const mainPath = `designs/${id}/main.jpg`;
    const thumbPath = `designs/${id}/thumb.jpg`;
    await uploadPhotos(supabase, mainPath, thumbPath, main, thumb);

    const embedding = await getEmbeddingProvider().embedImage(mainBytes, "document");
    const { error: updateError } = await supabase
      .from("designs")
      .update({
        main_image_path: mainPath,
        thumb_image_path: thumbPath,
        embedding: JSON.stringify(embedding),
        embedded_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (updateError) throw updateError;

    revalidateTag("catalog", "minutes");
    return NextResponse.json({ ok: true, target, paths: { main: mainPath, thumb: thumbPath } });
  }

  const { data: boothSale, error: boothSaleError } = await supabase
    .from("booth_sales")
    .select("id, sold_on")
    .eq("id", id)
    .maybeSingle();
  if (boothSaleError) throw boothSaleError;
  if (!boothSale) return NextResponse.json({ error: "Booth sale not found" }, { status: 404 });

  const mainPath = `booth/${boothSale.sold_on}/${id}-main.jpg`;
  const thumbPath = `booth/${boothSale.sold_on}/${id}-thumb.jpg`;
  await uploadPhotos(supabase, mainPath, thumbPath, main, thumb);

  const embedding = await getEmbeddingProvider().embedImage(mainBytes, "query");
  const { error: updateError } = await supabase
    .from("booth_sales")
    .update({
      photo_main_path: mainPath,
      photo_thumb_path: thumbPath,
      embedding: JSON.stringify(embedding),
      embedded_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (updateError) throw updateError;

  return NextResponse.json({ ok: true, target, paths: { main: mainPath, thumb: thumbPath } });
}
