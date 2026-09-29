import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { findPendingDesigns } from "../../scripts/ai-photos/pending";
import { createServiceClient } from "../helpers/local-supabase";

// Phase 10 §1/§4: which designs the AI-photos batch picks up.
describe("findPendingDesigns", () => {
  const supabase = createServiceClient();
  const prefix = `test-aiphotos-${randomUUID().slice(0, 8)}`;
  const ids: string[] = [];

  const rows = [
    { key: "active", status: "active", main: "designs/x/main.jpg", done: false },
    { key: "draft", status: "draft", main: "designs/x/main.jpg", done: false },
    { key: "archived", status: "archived", main: "designs/x/main.jpg", done: false },
    { key: "seed", status: "active", main: "seed/some-placeholder.svg", done: false },
    { key: "nophoto", status: "draft", main: null, done: false },
    { key: "done", status: "active", main: "designs/x/main.jpg", done: true },
  ] as const;

  beforeAll(async () => {
    for (const row of rows) {
      const { data, error } = await supabase
        .from("designs")
        .insert({
          slug: `${prefix}-${row.key}`,
          category: "necklace",
          name_en: `${prefix} ${row.key}`,
          price_cents: 1000,
          status: row.status,
          main_image_path: row.main,
          thumb_image_path: row.main,
          ai_photos_at: row.done ? new Date().toISOString() : null,
        })
        .select("id")
        .single();
      if (error) throw error;
      ids.push(data.id);
    }
  });

  afterAll(async () => {
    await supabase.from("designs").delete().in("id", ids);
  });

  it("returns only non-archived designs with a real photo and no AI photos yet", async () => {
    const pending = await findPendingDesigns(supabase);
    const ours = pending.filter((d) => d.slug.startsWith(prefix)).map((d) => d.slug.slice(prefix.length + 1));
    expect(ours.sort()).toEqual(["active", "draft"]);
  });

  it("honours the limit", async () => {
    expect(await findPendingDesigns(supabase, 1)).toHaveLength(1);
  });
});
