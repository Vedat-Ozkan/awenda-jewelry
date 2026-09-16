// Generates the JPEG fixtures used by e2e/resize.spec.ts (Phase 3 step 1):
// a plain 4000x3000 landscape photo, and a landscape-encoded photo carrying
// EXIF Orientation=6 (rotate 90° CW) so it displays as portrait. Content is
// flat gray with a dark corner block — the tests only check dimensions and
// EXIF, not pixels. Both fixtures are committed; re-run and commit again if
// changed.
//
// Usage: pnpm tsx scripts/make-fixtures.ts
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { encode } from "jpeg-js";
import piexif from "piexifjs";

const FIXTURES_DIR = join(import.meta.dirname, "..", "tests", "fixtures");

function makeFrame(width: number, height: number): Buffer {
  const data = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    data[i * 4] = 160; // R
    data[i * 4 + 1] = 160; // G
    data[i * 4 + 2] = 160; // B
    data[i * 4 + 3] = 255; // A
  }
  // Big label: a dark block in the upper-left quadrant.
  const blockWidth = Math.floor(width / 3);
  const blockHeight = Math.floor(height / 3);
  for (let y = 0; y < blockHeight; y++) {
    for (let x = 0; x < blockWidth; x++) {
      const i = (y * width + x) * 4;
      data[i] = 30;
      data[i + 1] = 30;
      data[i + 2] = 30;
    }
  }
  return data;
}

function encodeJpeg(width: number, height: number, quality: number): Buffer {
  const { data } = encode({ data: makeFrame(width, height), width, height }, quality);
  return Buffer.from(data);
}

function writeFixture(name: string, bytes: Buffer) {
  writeFileSync(join(FIXTURES_DIR, name), bytes);
  console.log(`${name}: ${(bytes.length / 1024).toFixed(1)} KB`);
}

// 1. Plain 4000x3000 landscape, no EXIF. Note: jpeg-js's baseline encoder
// outputs ~320 KB for a 4000x3000 frame regardless of `quality` or content
// (verified empirically — solid gray and the block pattern both land within
// 1 KB of each other at quality 1 and quality 50), so this one fixture is
// over the ~200 KB target in the phase file; the quality argument is kept
// for documentation even though it has no measurable effect here.
writeFixture("landscape-4000x3000.jpg", encodeJpeg(4000, 3000, 50));

// 2. Landscape-encoded raw pixels (1600x1200) with EXIF Orientation=6, so a
// viewer honouring EXIF displays it as 1200x1600 portrait.
const rawLandscape = encodeJpeg(1600, 1200, 50);
const exifBytes = piexif.dump({ "0th": { [piexif.ImageIFD.Orientation]: 6 } });
const withExif = piexif.insert(exifBytes, rawLandscape.toString("binary"));
writeFixture("portrait-exif-rotated.jpg", Buffer.from(withExif, "binary"));
