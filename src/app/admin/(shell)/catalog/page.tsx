import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";
import { CatalogList } from "./catalog-list";

type Category = Database["public"]["Enums"]["category"];
type Status = Database["public"]["Enums"]["design_status"];

const CATEGORIES: Category[] = [
  "necklace",
  "bracelet",
  "anklet",
  "ring",
  "earring",
  "bangle",
  "chain",
  "pendant",
];
const STATUSES: Status[] = ["draft", "active", "archived"];

// Catalog list (Phase 4 step 3): server component, RLS-enforced cookie
// client (designs_admin_all policy — is_admin() sees every status, unlike
// the public_designs view which hides drafts). Filters/search are URL
// search params so the page stays linkable. Total qty per design is the sum
// of its variants' qty_on_hand, fetched separately (matches the two-query +
// manual join pattern in src/lib/embeddings/search.ts rather than a
// PostgREST embedded-resource select).
export default async function AdminCatalogPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; status?: string; q?: string }>;
}) {
  const { category, status, q } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("designs")
    .select("id, slug, category, name_en, name_fr, price_cents, status, thumb_image_path")
    .order("created_at", { ascending: false });
  if (category) query = query.eq("category", category as Category);
  if (status) query = query.eq("status", status as Status);
  if (q) query = query.or(`name_en.ilike.%${q}%,name_fr.ilike.%${q}%`);

  const { data: designs, error } = await query;
  if (error) throw error;

  const designIds = designs.map((d) => d.id);
  const { data: variants, error: variantsError } =
    designIds.length > 0
      ? await supabase.from("variants").select("design_id, qty_on_hand").in("design_id", designIds)
      : { data: [], error: null };
  if (variantsError) throw variantsError;

  const totalQtyByDesign = new Map<string, number>();
  for (const v of variants) {
    totalQtyByDesign.set(v.design_id, (totalQtyByDesign.get(v.design_id) ?? 0) + v.qty_on_hand);
  }

  const rows = designs.map((d) => ({ ...d, totalQty: totalQtyByDesign.get(d.id) ?? 0 }));

  return (
    <div className="p-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-lg font-semibold">Catalog</h1>
        <div className="flex items-center gap-3 text-sm">
          <a href="/api/admin/catalog.csv" className="underline">
            Export CSV
          </a>
          <Link
            href="/admin/catalog/new"
            className="rounded bg-black px-3 py-1.5 text-white dark:bg-white dark:text-black"
          >
            New design
          </Link>
        </div>
      </div>

      <form method="get" className="mt-4 flex flex-wrap gap-2">
        <select
          name="category"
          defaultValue={category ?? ""}
          className="rounded border border-black/[.15] px-2 py-1.5 text-sm dark:border-white/[.2]"
        >
          <option value="">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          name="status"
          defaultValue={status ?? ""}
          className="rounded border border-black/[.15] px-2 py-1.5 text-sm dark:border-white/[.2]"
        >
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <input
          type="search"
          name="q"
          placeholder="Search name"
          defaultValue={q ?? ""}
          className="rounded border border-black/[.15] px-2 py-1.5 text-sm dark:border-white/[.2]"
        />
        <button type="submit" className="rounded border border-black/[.15] px-3 py-1.5 text-sm dark:border-white/[.2]">
          Filter
        </button>
      </form>

      <CatalogList designs={rows} />
    </div>
  );
}
