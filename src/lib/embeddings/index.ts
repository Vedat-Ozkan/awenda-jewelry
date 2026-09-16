import { env } from "@/lib/env";
import { fakeProvider } from "./fake";
import { voyageProvider } from "./voyage";

export { DIMS, type EmbeddingProvider } from "./types";

// Picks the embedding provider by EMBEDDINGS_PROVIDER. Defaults to `fake`
// only when unset AND running under Vitest (NODE_ENV=test), so CI/tests
// never need a Voyage key; every other environment must set it explicitly.
export function getEmbeddingProvider() {
  const provider = env.EMBEDDINGS_PROVIDER ?? (process.env.NODE_ENV === "test" ? "fake" : undefined);

  if (provider === "fake") return fakeProvider;
  if (provider === "voyage") return voyageProvider;

  throw new Error(
    "EMBEDDINGS_PROVIDER must be set to 'voyage' or 'fake' (defaults to 'fake' only when NODE_ENV=test)",
  );
}
