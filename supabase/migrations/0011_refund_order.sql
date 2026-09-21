-- Phase 6 step 6 (orders admin refund action): flips fulfilled=false and
-- restores stock for the given order_items, skipping any already
-- fulfilled=false (already refunded, or sold-out at webhook time), then
-- closes the order out (status='refunded', refunded_at) once no fulfilled
-- item remains. Called after the Stripe refund itself has already
-- succeeded — refundOrder() (orders admin actions.ts) computes the refund
-- amount in JS from the still-fulfilled lines before calling this, same
-- split of responsibility as create_order_from_checkout() vs. the webhook
-- route. security definer + revoked from public/anon/authenticated, same
-- posture as create_order_from_checkout()/bulk_restock()
-- (0009_create_order_from_checkout.sql, 0006_bulk_ops.sql) — only the
-- service client (the orders admin server actions) calls this.
create function refund_order_items(p_order_id uuid, p_item_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item record;
  v_remaining int;
begin
  for v_item in
    select id, variant_id, qty from order_items
    where order_id = p_order_id and id = any(p_item_ids) and fulfilled = true
  loop
    if v_item.variant_id is not null then
      perform adjust_inventory(v_item.variant_id, v_item.qty, 'refund', p_order_id, null);
    end if;
    update order_items set fulfilled = false where id = v_item.id;
  end loop;

  select count(*) into v_remaining from order_items
    where order_id = p_order_id and fulfilled = true;

  if v_remaining = 0 then
    update orders set status = 'refunded', refunded_at = now() where id = p_order_id;
  end if;
end;
$$;
revoke execute on function refund_order_items(uuid, uuid[]) from public, anon, authenticated;
