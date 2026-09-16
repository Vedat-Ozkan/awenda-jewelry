// Deterministic fake embedding provider for tests/CI — zero network, no API
// key. The vector is derived by hashing the input bytes with FNV-1a (32-bit),
// seeding a mulberry32 PRNG with that hash, drawing DIMS values via the
// Box-Muller transform (gaussian-ish), and normalising to unit length.
//
// Marker rule: if the bytes, decoded as latin1, contain the literal string
// `AWENDA_FAKE_KEY=<k>` where `<k>` matches [A-Za-z0-9_-]+, the vector is
// derived from `<k>` alone (ignoring the rest of the bytes). Test fixtures
// use this so two different "photos" of the same item produce identical
// embeddings without needing identical image bytes.
import { DIMS, type EmbeddingProvider } from "./types";

const MARKER = /AWENDA_FAKE_KEY=([A-Za-z0-9_-]+)/;

function fnv1a(str: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function mulberry32(seed: number) {
  let a = seed;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const fakeProvider: EmbeddingProvider = {
  async embedImage(image) {
    const buffer = image instanceof Blob ? await image.arrayBuffer() : image;
    const text = Buffer.from(buffer).toString("latin1");
    const match = text.match(MARKER);
    const seedSource = match ? match[1] : text;

    const random = mulberry32(fnv1a(seedSource));
    const vector: number[] = [];
    for (let i = 0; i < DIMS; i++) {
      const u1 = Math.max(random(), Number.EPSILON);
      const u2 = random();
      vector.push(Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2));
    }

    const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
    return vector.map((v) => v / norm);
  },
};
