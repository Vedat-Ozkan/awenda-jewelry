// Standalone check: reads an image file, embeds it with the provider chosen
// by EMBEDDINGS_PROVIDER, and prints the provider/model and vector length.
//
// Usage:
//   pnpm embed:check <path/to/image.jpg>
// Offline (no Voyage key needed):
//   EMBEDDINGS_PROVIDER=fake pnpm embed:check <path/to/image.jpg>
//
// Run via `tsx` (not plain `node`) so the `@/*` path alias and tsconfig
// `paths` resolve the same way they do in the Next.js app.
import { readFile } from "node:fs/promises";
import { env } from "@/lib/env";
import { getEmbeddingProvider } from "@/lib/embeddings";
import { VOYAGE_MODEL } from "@/lib/embeddings/voyage";

// Wrapped in an async function, not top-level await: tsx transpiles this
// file to CJS (no "type": "module" in package.json), which disallows
// top-level await.
async function main() {
  const path = process.argv[2];
  if (!path) {
    console.error("Usage: embed-check.ts <path/to/image.jpg>");
    process.exit(1);
  }

  const file = await readFile(path);
  const bytes = file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength) as ArrayBuffer;

  const provider = getEmbeddingProvider();
  const vector = await provider.embedImage(bytes, "document");

  const model = env.EMBEDDINGS_PROVIDER === "voyage" ? ` model=${VOYAGE_MODEL}` : "";
  console.log(`provider=${env.EMBEDDINGS_PROVIDER}${model} length=${vector.length}`);
}

main();
