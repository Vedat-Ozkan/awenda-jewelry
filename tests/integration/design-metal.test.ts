import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it, vi } from "vitest";
import { createAnonClient, createServiceClient } from "../helpers/local-supabase";

// Same mocking pattern as tests/integration/catalog-queries.test.ts.
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => createServiceClient(),
}));
vi.mock("@/lib/catalog/client", () => ({
  createAnonClient: () => createAnonClient(),
}));
vi.mock("next/cache", () => ({ unstable_cache: (fn: (...args: never[]) => unknown) => fn }));

const { getDesigns } = await import("@/lib/catalog");

const anon = createAnonClient();
const service = createServiceClient();
const prefix = `test-metal-${randomUUID().slice(0, 8)}`;
const designIds: string[] = [];

afterAll(async () => {
  if (designIds.length > 0) await service.from("designs").delete().in("id", designIds);
});

describe("designs.metal (0014_design_metal.sql)", () => {
  it("anon can read metal from public_designs; seeded Silver designs are sterling silver", async () => {
    const { data, error } = await anon.from("public_designs").select("slug, metal").eq("slug", "silver-necklace-16");
    expect(error).toBeNull();
    expect(data).toEqual([{ slug: "silver-necklace-16", metal: "sterling_silver" }]);
  });

  it("defaults to stainless_steel and rejects unknown metals", async () => {
    const { data, error } = await service
      .from("designs")
      .insert({ slug: `${prefix}-default`, category: "ring", name_en: "Metal default", price_cents: 1000, status: "active" })
      .select("id, metal")
      .single();
    expect(error).toBeNull();
    designIds.push(data!.id);
    expect(data!.metal).toBe("stainless_steel");

    const { error: badError } = await service
      .from("designs")
      .update({ metal: "gold" as never })
      .eq("id", data!.id);
    expect(badError).not.toBeNull();
  });

  it("getDesigns({ metal }) returns only designs of that metal", async () => {
    const { data: silver, error } = await service
      .from("designs")
      .insert({
        slug: `${prefix}-silver`,
        category: "ring",
        name_en: "Metal silver",
        price_cents: 1000,
        status: "active",
        metal: "sterling_silver",
      })
      .select("id")
      .single();
    expect(error).toBeNull();
    designIds.push(silver!.id);

    const silverList = await getDesigns({ metal: "sterling_silver" }, "en");
    expect(silverList.length).toBeGreaterThan(0);
    expect(silverList.every((d) => d.metal === "sterling_silver")).toBe(true);
    expect(silverList.map((d) => d.slug)).toContain(`${prefix}-silver`);
    expect(silverList.map((d) => d.slug)).not.toContain(`${prefix}-default`);

    const steelList = await getDesigns({ metal: "stainless_steel" }, "en");
    expect(steelList.every((d) => d.metal === "stainless_steel")).toBe(true);
    expect(steelList.map((d) => d.slug)).toContain(`${prefix}-default`);

    const all = await getDesigns({}, "en");
    expect(all.map((d) => d.slug)).toEqual(expect.arrayContaining([`${prefix}-silver`, `${prefix}-default`]));
  });
});
