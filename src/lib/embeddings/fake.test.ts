import { describe, expect, it } from "vitest";
import { DIMS } from "./types";
import { fakeProvider } from "./fake";

// Buffer.from(string) for short strings allocates from Node's shared buffer
// pool, so `.buffer` alone is the whole pool, not just these bytes — slice by
// byteOffset/byteLength to get an ArrayBuffer scoped to this string only.
function bytesOf(text: string): ArrayBuffer {
  const buf = Buffer.from(text, "latin1");
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
}

describe("fakeProvider", () => {
  it("is deterministic across calls", async () => {
    const bytes = bytesOf("some fake jpeg bytes");
    const a = await fakeProvider.embedImage(bytes, "document");
    const b = await fakeProvider.embedImage(bytes, "document");
    expect(a).toEqual(b);
  });

  it("returns a unit vector of length DIMS", async () => {
    const vector = await fakeProvider.embedImage(bytesOf("another blob"), "query");
    expect(vector).toHaveLength(DIMS);
    const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
    expect(Math.abs(1 - norm)).toBeLessThan(1e-6);
  });

  it("two different byte blobs with the same AWENDA_FAKE_KEY are identical", async () => {
    const a = await fakeProvider.embedImage(
      bytesOf("JPEGDATA...AWENDA_FAKE_KEY=item-a...more junk"),
      "document",
    );
    const b = await fakeProvider.embedImage(
      bytesOf("totally different bytes AWENDA_FAKE_KEY=item-a padding"),
      "query",
    );
    expect(a).toEqual(b);
  });

  it("different keys produce different vectors", async () => {
    const a = await fakeProvider.embedImage(bytesOf("AWENDA_FAKE_KEY=item-a"), "document");
    const b = await fakeProvider.embedImage(bytesOf("AWENDA_FAKE_KEY=item-b"), "document");
    expect(a).not.toEqual(b);
  });

  it("no-marker blobs differ from each other", async () => {
    const a = await fakeProvider.embedImage(bytesOf("plain bytes one"), "document");
    const b = await fakeProvider.embedImage(bytesOf("plain bytes two"), "document");
    expect(a).not.toEqual(b);
  });
});
