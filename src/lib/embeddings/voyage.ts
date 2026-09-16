// Voyage AI multimodal embeddings (see DECISIONS.md "Embeddings: Voyage AI
// multimodal"). Verified against docs.voyageai.com on 2026-09-16 (Phase 3
// step 2): newest stable multimodal model is `voyage-multimodal-3.5`
// (`voyage-multimodal-3` is the prior generation), output dimension is
// configurable but defaults to 1024 — matching the `vector(1024)` columns —
// so no migration is needed. Pricing: $0.60/billion pixels, $0.0012/image
// max (2 MP cap), free tier 200M text tokens + 150B pixels. See
// DECISIONS.md Open #12.
//
// Deliberately plain TS, not `import "server-only"`: that package throws
// when loaded outside a Next.js server bundle, which would break this
// file's own tests and `scripts/embed-check.ts` (run via `tsx`, not Next).
// Callers must not import this module from client code — only
// `src/app/api/photos/route.ts` (admin-only route handler) and
// `scripts/embed-check.ts` should.
import { env } from "@/lib/env";
import { DIMS, type EmbeddingProvider } from "./types";

export const VOYAGE_MODEL = "voyage-multimodal-3.5";

const ENDPOINT = "https://api.voyageai.com/v1/multimodalembeddings";
const TIMEOUT_MS = 20_000;
const RETRY_DELAY_MS = 500;

type VoyageResponse = {
  data: { embedding: number[] }[];
};

async function callVoyage(body: unknown): Promise<Response> {
  return fetch(ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.VOYAGE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
}

export const voyageProvider: EmbeddingProvider = {
  async embedImage(image, kind) {
    const buffer = image instanceof Blob ? await image.arrayBuffer() : image;
    const base64 = Buffer.from(buffer).toString("base64");
    const mediaType = image instanceof Blob && image.type ? image.type : "image/jpeg";

    const body = {
      inputs: [{ content: [{ type: "image_base64", image_base64: `data:${mediaType};base64,${base64}` }] }],
      model: VOYAGE_MODEL,
      input_type: kind,
    };

    let response = await callVoyage(body);
    if (!response.ok && (response.status === 429 || response.status >= 500)) {
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
      response = await callVoyage(body);
    }
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Voyage embed request failed (${response.status}): ${text}`);
    }

    const json = (await response.json()) as VoyageResponse;
    const embedding = json.data[0]?.embedding;
    if (!embedding || embedding.length !== DIMS) {
      throw new Error(
        `Voyage embed response has unexpected shape (expected length ${DIMS}, got ${embedding?.length})`,
      );
    }
    return embedding;
  },
};
