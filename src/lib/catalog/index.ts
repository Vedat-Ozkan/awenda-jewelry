import { unstable_cache } from "next/cache";
import type { Locale } from "@/i18n/routing";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/database.types";
import { createAnonClient } from "./client";
import { localize } from "./localize";

type Category = Database["public"]["Enums"]["category"];
// public_designs/public_settings are views (0004_rls.sql), so generated
// types put them under Views, not Tables.
type PublicDesignRow = Database["public"]["Views"]["public_designs"]["Row"];
type PublicSettingsRow = Database["public"]["Views"]["public_settings"]["Row"];
type Status = "active" | "archived";

// Phase 5 step 4: category tabs + `/c/[category]` route validation both need
// the same fixed list (DECISIONS.md "Categories and default variant
// presets"). Header.tsx (Phase 5 step 3, chunk A) keeps its own local copy
// for the nav — not worth a shared-import refactor for eight strings — but
// `isCategory` is the one piece route validation actually needs.
export const CATEGORIES: Category[] = [
  "necklace",
  "bracelet",
  "anklet",
  "ring",
  "earring",
  "bangle",
  "chain",
  "pendant",
];

export function isCategory(value: string): value is Category {
  return (CATEGORIES as string[]).includes(value);
}

export type Sort = "newest" | "price_asc" | "price_desc";

export interface Variant {
  id: string;
  label: string;
  qty_on_hand: number;
}

export interface DesignCard {
  id: string;
  slug: string;
  category: Category;
  name: string;
  price_cents: number;
  thumb_image_path: string | null;
  total_qty: number;
  status: Status;
  created_at: string;
}

export interface DesignImage {
  id: string;
  main_image_path: string;
  thumb_image_path: string;
  sort_order: number;
}

export interface DesignDetail extends DesignCard {
  description: string | null;
  material: string | null;
  dimensions: string | null;
  main_image_path: string | null;
  variants: Variant[];
  images: DesignImage[];
}

export interface Settings {
  marketName: string | null;
  marketAddress: string | null;
  nextMarketDate: string | null;
  // Phase 5 steps 4/7: the catalog's closed-note strip and the /pickup page
  // both need these; chunk A's Settings only carried what the step 3 footer
  // needed.
  marketWeekday: number | null;
  marketOpenTime: string | null;
  marketCloseTime: string | null;
  marketClosedUntil: string | null;
  marketClosedNoteEn: string | null;
  marketClosedNoteFr: string | null;
  shippingEnabled: boolean;
  freeShippingThresholdCents: number | null;
  shippingFlatCents: number | null;
  pickupInstructionsEn: string | null;
  pickupInstructionsFr: string | null;
}

const EMPTY_SETTINGS: Settings = {
  marketName: null,
  marketAddress: null,
  nextMarketDate: null,
  marketWeekday: null,
  marketOpenTime: null,
  marketCloseTime: null,
  marketClosedUntil: null,
  marketClosedNoteEn: null,
  marketClosedNoteFr: null,
  shippingEnabled: false,
  freeShippingThresholdCents: null,
  shippingFlatCents: null,
  pickupInstructionsEn: null,
  pickupInstructionsFr: null,
};

function toDesignCard(row: PublicDesignRow, locale: Locale): DesignCard {
  return {
    id: row.id!,
    slug: row.slug!,
    category: row.category!,
    name: localize(row, locale).name,
    price_cents: row.price_cents!,
    thumb_image_path: row.thumb_image_path,
    total_qty: row.total_qty ?? 0,
    status: row.status as Status,
    created_at: row.created_at!,
  };
}

async function fetchDesigns(category: Category | undefined, sort: Sort, locale: Locale): Promise<DesignCard[]> {
  const supabase = createAnonClient();
  let query = supabase.from("public_designs").select("*");
  if (category) query = query.eq("category", category);

  if (sort === "price_asc") query = query.order("price_cents", { ascending: true });
  else if (sort === "price_desc") query = query.order("price_cents", { ascending: false });
  else query = query.order("created_at", { ascending: false });

  const { data, error } = await query;
  if (error) throw error;

  return data.map((row) => toDesignCard(row, locale));
}

const getCachedDesigns = unstable_cache(fetchDesigns, ["catalog", "designs"], {
  tags: ["catalog"],
  revalidate: 60,
});

// Storefront catalog list (Phase 5 step 2). `public_designs` already
// excludes drafts (0004_rls.sql).
export function getDesigns(
  { category, sort = "newest" }: { category?: Category; sort?: Sort } = {},
  locale: Locale = "en",
): Promise<DesignCard[]> {
  return getCachedDesigns(category, sort, locale);
}

async function fetchDesignBySlug(slug: string, locale: Locale): Promise<DesignDetail | null> {
  const supabase = createAnonClient();

  const { data: row, error } = await supabase.from("public_designs").select("*").eq("slug", slug).maybeSingle();
  if (error) throw error;
  if (!row) return null;

  const { data: images, error: imagesError } = await supabase
    .from("design_images")
    .select("id, main_image_path, thumb_image_path, sort_order")
    .eq("design_id", row.id!)
    .order("sort_order");
  if (imagesError) throw imagesError;

  const localized = localize(row, locale);

  return {
    ...toDesignCard(row, locale),
    description: localized.description,
    material: localized.material,
    dimensions: row.dimensions,
    main_image_path: row.main_image_path,
    variants: ((row.variants as unknown as Variant[]) ?? []).slice(),
    images: images ?? [],
  };
}

const getCachedDesignBySlug = unstable_cache(fetchDesignBySlug, ["catalog", "design"], {
  tags: ["catalog"],
  revalidate: 60,
});

// Product page data (Phase 5 step 5 uses this; this chunk only wires it up).
export function getDesignBySlug(slug: string, locale: Locale = "en"): Promise<DesignDetail | null> {
  return getCachedDesignBySlug(slug, locale);
}

// 301 support for renamed designs (Phase 5 step 5, migration 0005's
// `previous_slugs`). Uncached and on the `designs` table directly via the
// admin client: `public_designs` doesn't expose `previous_slugs`, and
// `designs` has no anon select policy (DECISIONS.md "Phase 3 plan drift" —
// same reasoning as getSimilar below). Excludes drafts to match
// `public_designs`'s own filter.
export async function getCurrentSlugFor(oldSlug: string): Promise<string | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("designs")
    .select("slug")
    .contains("previous_slugs", [oldSlug])
    .neq("status", "draft")
    .maybeSingle();
  if (error) throw error;
  return data?.slug ?? null;
}

async function fetchSettings(): Promise<Settings> {
  const supabase = createAnonClient();

  const [{ data: settings, error: settingsError }, { data: nextMarketDate, error: dateError }] = await Promise.all([
    supabase.from("public_settings").select("*").maybeSingle(),
    supabase.rpc("next_market_date"),
  ]);
  if (settingsError) throw settingsError;
  if (dateError) throw dateError;
  // Migration 0007 guarantees the row, but never let a missing row take the
  // storefront down: render with market info unknown and shipping off.
  if (!settings) return EMPTY_SETTINGS;

  return toSettings(settings, nextMarketDate);
}

function toSettings(row: PublicSettingsRow, nextMarketDate: string | null): Settings {
  return {
    marketName: row.market_name,
    marketAddress: row.market_address,
    nextMarketDate,
    marketWeekday: row.market_weekday,
    marketOpenTime: row.market_open_time,
    marketCloseTime: row.market_close_time,
    marketClosedUntil: row.market_closed_until,
    marketClosedNoteEn: row.market_closed_note_en,
    marketClosedNoteFr: row.market_closed_note_fr,
    shippingEnabled: row.shipping_enabled ?? false,
    freeShippingThresholdCents: row.free_shipping_threshold_cents,
    shippingFlatCents: row.shipping_flat_cents,
    pickupInstructionsEn: row.pickup_instructions_en,
    pickupInstructionsFr: row.pickup_instructions_fr,
  };
}

const getCachedSettings = unstable_cache(fetchSettings, ["catalog", "settings"], {
  tags: ["catalog"],
  revalidate: 60,
});

export function getSettings(): Promise<Settings> {
  return getCachedSettings();
}

// "Similar styles" (Phase 5 steps 2/5, DECISIONS.md "Phase 3 plan drift":
// match_designs() is service-role-only, so this runs server-side with the
// admin client — never exposed to the browser). Reads the design's own
// embedding, asks match_designs() for k+1 candidates (to make room for
// dropping the design itself), then sorts in-stock first. Tops up with the
// newest in-stock designs — same category first, then any category — when
// there's no embedding yet (draft just published, embedding step failed,
// etc.) or the embedding/category pool alone doesn't reach k: step 5 wants
// "similar styles" shown *always*, and with a young catalog a single
// category rarely has k in-stock designs on its own (seed: at most one).
export async function getSimilar(designId: string, k = 4, locale: Locale = "en"): Promise<DesignCard[]> {
  const supabase = createAdminClient();

  const { data: design, error: designError } = await supabase
    .from("designs")
    .select("embedding, category")
    .eq("id", designId)
    .single();
  if (designError) throw designError;

  let cards: DesignCard[] = [];

  if (design.embedding) {
    const { data: matches, error: matchError } = await supabase.rpc("match_designs", {
      query_embedding: design.embedding,
      match_count: k + 1,
    });
    if (matchError) throw matchError;

    const ids = (matches ?? []).map((m) => m.design_id).filter((id) => id !== designId).slice(0, k);
    if (ids.length > 0) {
      const { data: rows, error: rowsError } = await supabase.from("public_designs").select("*").in("id", ids);
      if (rowsError) throw rowsError;

      const byId = new Map(rows.map((r) => [r.id, r]));
      cards = ids
        .map((id) => byId.get(id))
        .filter((row): row is PublicDesignRow => row != null)
        .map((row) => toDesignCard(row, locale));
    }
  }

  if (cards.length < k) {
    cards = cards.concat(
      await topUpInStock(supabase, k - cards.length, [designId, ...cards.map((c) => c.id)], locale, design.category),
    );
  }
  if (cards.length < k) {
    cards = cards.concat(
      await topUpInStock(supabase, k - cards.length, [designId, ...cards.map((c) => c.id)], locale),
    );
  }

  return cards.sort((a, b) => Number(b.total_qty > 0) - Number(a.total_qty > 0));
}

// Newest in-stock designs not already in `excludeIds`, optionally scoped to
// `category`. Filters exclusions client-side (rather than a `.not(..., "in",
// ...)` filter) to match the style already used just above for the
// embedding-match branch.
async function topUpInStock(
  supabase: ReturnType<typeof createAdminClient>,
  count: number,
  excludeIds: string[],
  locale: Locale,
  category?: Category,
): Promise<DesignCard[]> {
  const excluded = new Set(excludeIds);
  let query = supabase
    .from("public_designs")
    .select("*")
    .gt("total_qty", 0)
    .order("created_at", { ascending: false })
    .limit(count + excluded.size);
  if (category) query = query.eq("category", category);

  const { data: rows, error } = await query;
  if (error) throw error;

  return rows
    .filter((row) => !excluded.has(row.id!))
    .slice(0, count)
    .map((row) => toDesignCard(row, locale));
}
