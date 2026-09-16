"use server";

import { randomUUID } from "node:crypto";
import type { Candidate } from "@/lib/embeddings/search";
import { findCandidates } from "@/lib/embeddings/search";
import { requireAdminFromCookies } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/database.types";

type Category = Database["public"]["Enums"]["category"];

// Server actions for the dev harness page (Phase 3 step 5). Server actions
// have no Request to pass to requireAdmin(), so they use
// requireAdminFromCookies() instead — same admin_emails check, cookie
// session only.

// The page itself 404s in production (page.tsx), but a server action is a
// reachable endpoint on its own — guard each one too, defense in depth.
function assertDev() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Dev harness actions are disabled in production");
  }
}

export async function createDevDesign(category: Category): Promise<{ id: string }> {
  assertDev();
  await requireAdminFromCookies();
  const supabase = createAdminClient();

  const { data: design, error } = await supabase
    .from("designs")
    .insert({
      slug: `dev-${randomUUID().slice(0, 8)}`,
      category,
      name_en: `Dev item ${new Date().toISOString()}`,
      price_cents: 1000,
      status: "active",
    })
    .select("id")
    .single();
  if (error) throw error;

  return { id: design.id };
}

export async function createDevBoothSale(category: Category): Promise<{ id: string }> {
  assertDev();
  await requireAdminFromCookies();
  const supabase = createAdminClient();

  const { data: boothSale, error } = await supabase
    .from("booth_sales")
    .insert({
      category,
      variant_label: "One size",
      photo_main_path: "pending",
      photo_thumb_path: "pending",
      status: "pending",
    })
    .select("id")
    .single();
  if (error) throw error;

  return { id: boothSale.id };
}

export async function devFindCandidates(boothSaleId: string): Promise<Candidate[]> {
  assertDev();
  await requireAdminFromCookies();
  return findCandidates(boothSaleId);
}
