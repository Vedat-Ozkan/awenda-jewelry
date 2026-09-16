// Output length of every embedding this app stores or compares. Matches the
// `vector(1024)` columns on `designs`/`booth_sales` (0002_core.sql) and the
// `query_embedding vector(1024)` arg of `match_designs()` (0003_functions.sql).
export const DIMS = 1024;

export interface EmbeddingProvider {
  embedImage(image: Blob | ArrayBuffer, kind: "document" | "query"): Promise<number[]>; // length DIMS
}
