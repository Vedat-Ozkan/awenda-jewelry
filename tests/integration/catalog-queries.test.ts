import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it, vi } from "vitest";
import { createAnonClient as createLocalAnonClient, createServiceClient } from "../helpers/local-supabase";
import { fakeProvider } from "@/lib/embeddings/fake";

// Phase 5 step 2. Same mocking pattern as tests/integration/search.test.ts:
// `@/lib/supabase/admin` and `@/lib/catalog/client` both import `server-only`
// (throws outside a Next.js server bundle), so they're swapped for the real
// local-Supabase clients this test's own setup uses.
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => createServiceClient(),
}));
vi.mock("@/lib/catalog/client", () => ({
  createAnonClient: () => createLocalAnonClient(),
}));
// unstable_cache needs a Next.js request/render context that doesn't exist
// under Vitest (same reasoning as `revalidatePath` in tests/integration/catalog-actions.test.ts)
// — bypassed here so every call hits the DB directly.
vi.mock("next/cache", () => ({ unstable_cache: (fn: (...args: never[]) => unknown) => fn }));

const { getDesigns, getDesignBySlug, getSimilar } = await import("@/lib/catalog");

const service = createServiceClient();
const prefix = `test-catalog-${randomUUID().slice(0, 8)}`;

async function embed(key: string): Promise<string> {
  const bytes = Buffer.from(`AWENDA_FAKE_KEY=${key}`, "latin1");
  const vector = await fakeProvider.embedImage(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
    "document",
  );
  return `[${vector.join(",")}]`;
}

async function createDesign(opts: {
  slug: string;
  status?: "draft" | "active";
  nameFr?: string;
  embeddingKey?: string;
}) {
  const { data, error } = await service
    .from("designs")
    .insert({
      slug: opts.slug,
      category: "ring",
      name_en: opts.slug,
      name_fr: opts.nameFr ?? null,
      price_cents: 1000,
      status: opts.status ?? "active",
      embedding: opts.embeddingKey ? await embed(opts.embeddingKey) : null,
    })
    .select("id")
    .single();
  if (error) throw error;
  await service.from("variants").insert({ design_id: data.id, label: "One size", qty_on_hand: 2 });
  return data.id as string;
}

const designIds: string[] = [];

afterAll(async () => {
  if (designIds.length > 0) {
    await service.from("designs").delete().in("id", designIds);
  }
});

describe("getDesigns", () => {
  it("excludes drafts", async () => {
    const activeId = await createDesign({ slug: `${prefix}-active` });
    const draftId = await createDesign({ slug: `${prefix}-draft`, status: "draft" });
    designIds.push(activeId, draftId);

    const designs = await getDesigns({ sort: "newest" }, "en");
    const slugs = designs.map((d) => d.slug);

    expect(slugs).toContain(`${prefix}-active`);
    expect(slugs).not.toContain(`${prefix}-draft`);
  });
});

describe("getDesignBySlug", () => {
  it("falls back to English when the French name is missing", async () => {
    const slug = `${prefix}-fallback`;
    const id = await createDesign({ slug });
    designIds.push(id);

    const design = await getDesignBySlug(slug, "fr");

    expect(design?.name).toBe(slug);
    expect(design?.variants).toEqual([expect.objectContaining({ label: "One size", qty_on_hand: 2 })]);
  });
});

describe("getSimilar", () => {
  it("excludes the design itself and prefers same-category, in-stock matches", async () => {
    const aId = await createDesign({ slug: `${prefix}-similar-a`, embeddingKey: "A" });
    const bId = await createDesign({ slug: `${prefix}-similar-b`, embeddingKey: "A" });
    designIds.push(aId, bId);

    const similar = await getSimilar(aId, 4, "en");

    expect(similar.some((d) => d.id === aId)).toBe(false);
    expect(similar.some((d) => d.id === bId)).toBe(true);
  });
});
