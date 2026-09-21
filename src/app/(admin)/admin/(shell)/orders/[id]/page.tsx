import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OrderDetailClient } from "./order-detail-client";

// Order detail (Phase 6 step 6): server component, RLS-enforced cookie
// client. Two extra queries (order_items, inventory_movements where
// ref_id = order.id) rather than a PostgREST embedded-resource select, same
// pattern as catalog/[id]/page.tsx.
export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: order, error: orderError } = await supabase.from("orders").select("*").eq("id", id).maybeSingle();
  if (orderError) throw orderError;
  if (!order) notFound();

  const { data: items, error: itemsError } = await supabase
    .from("order_items")
    .select("id, name_snapshot, variant_label_snapshot, unit_price_cents, qty, fulfilled")
    .eq("order_id", id);
  if (itemsError) throw itemsError;

  const { data: movements, error: movementsError } = await supabase
    .from("inventory_movements")
    .select("id, delta, reason, created_at")
    .eq("ref_id", id)
    .order("created_at", { ascending: false });
  if (movementsError) throw movementsError;

  return <OrderDetailClient order={order} items={items} movements={movements} />;
}
