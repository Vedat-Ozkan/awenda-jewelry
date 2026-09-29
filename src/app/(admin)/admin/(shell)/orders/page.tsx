import { createClient } from "@/lib/supabase/server";
import { OrdersList } from "./orders-list";

// Orders list (Phase 6 step 6): server component, RLS-enforced cookie
// client (orders_admin_all policy — is_admin() sees every order). The ~200
// most recent orders, with an item-count (summed qty) fetched separately —
// same two-query + manual join pattern as the catalog admin
// (catalog/page.tsx's totalQtyByDesign).
export default async function AdminOrdersPage() {
  const supabase = await createClient();

  const { data: orders, error } = await supabase
    .from("orders")
    .select("id, status, fulfillment, customer_name, customer_email, total_cents, created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;

  const orderIds = orders.map((o) => o.id);
  const { data: items, error: itemsError } =
    orderIds.length > 0
      ? await supabase.from("order_items").select("order_id, qty").in("order_id", orderIds)
      : { data: [], error: null };
  if (itemsError) throw itemsError;

  const itemCountByOrder = new Map<string, number>();
  for (const item of items) {
    itemCountByOrder.set(item.order_id, (itemCountByOrder.get(item.order_id) ?? 0) + item.qty);
  }

  const rows = orders.map((o) => ({ ...o, itemCount: itemCountByOrder.get(o.id) ?? 0 }));

  return (
    <div className="p-4">
      <h1 className="text-lg font-semibold">Orders</h1>
      <OrdersList orders={rows} />
    </div>
  );
}
