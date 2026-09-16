// Browser-only image pipeline (Phase 3 step 1): produces a ≤1024px-long-edge
// "main" JPEG and a ≤400px-long-edge "thumb" JPEG from a photo. No Node
// imports — used from client components (src/app/admin/dev/embed) and
// exposed as window.__awendaResize there for the Playwright test.
//
// `createImageBitmap(file, { imageOrientation: "from-image" })` honours EXIF
// orientation, and canvas-drawn output carries no EXIF, so this also strips
// it. Never upscales: if the source is already smaller than the target long
// edge, it's kept at its own size.
const MAIN_MAX_EDGE = 1024;
const THUMB_MAX_EDGE = 400;
const JPEG_QUALITY = 0.85;

export interface ResizeResult {
  main: Blob;
  thumb: Blob;
  width: number;
  height: number;
}

function scaledSize(bitmap: ImageBitmap, maxEdge: number) {
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  return { width: Math.round(bitmap.width * scale), height: Math.round(bitmap.height * scale) };
}

function drawToJpeg(bitmap: ImageBitmap, width: number, height: number): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2d context unavailable");
  ctx.drawImage(bitmap, 0, 0, width, height);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Canvas toBlob failed"))),
      "image/jpeg",
      JPEG_QUALITY,
    );
  });
}

export async function resizeImage(file: File | Blob): Promise<ResizeResult> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  try {
    const mainSize = scaledSize(bitmap, MAIN_MAX_EDGE);
    const thumbSize = scaledSize(bitmap, THUMB_MAX_EDGE);
    const [main, thumb] = await Promise.all([
      drawToJpeg(bitmap, mainSize.width, mainSize.height),
      drawToJpeg(bitmap, thumbSize.width, thumbSize.height),
    ]);
    return { main, thumb, width: mainSize.width, height: mainSize.height };
  } finally {
    bitmap.close();
  }
}
