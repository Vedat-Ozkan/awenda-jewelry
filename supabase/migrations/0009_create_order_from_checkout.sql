-- Phase 6 step 3: atomically creates an order + order_items from a completed
-- Stripe Checkout Session and decrements inventory via adjust_inventory()
-- for each line, in one implicit transaction (a single function call).
-- security definer + revoked from public/anon/authenticated, same posture as
-- adjust_inventory()/bulk_restock() (0003_functions.sql, 0006_bulk_ops.sql)
-- — only the webhook route (service client) calls this.
--
-- p_payload shape: { order: {...order columns...}, items: [{variant_id,
-- design_id, name_snapshot, variant_label_snapshot, unit_price_cents, qty}] }
--
-- Idempotent on stripe_checkout_session_id: a duplicate delivery of the same
-- (or a later async_payment_succeeded) event returns the existing order's id
-- with existing=true and does nothing else, so the webhook route knows to
-- skip the inventory decrement and the confirmation/refund email.
--
-- Insufficient stock on one line (DECISIONS.md "Inventory decrement timing
-- for online orders") does not fail the whole order: that line's
-- adjust_inventory() call is caught (insufficient_stock, P0001) and the item
-- is inserted with fulfilled=false instead. The caller (the webhook route)
-- decides on the refund.
create function create_order_from_checkout(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order jsonb := p_payload->'order';
  v_items jsonb := p_payload->'items';
  v_order_id uuid;
  v_existing_id uuid;
  v_item jsonb;
  v_item_id uuid;
  v_unfulfilled jsonb := '[]'::jsonb;
begin
  select id into v_existing_id from orders
    where stripe_checkout_session_id = v_order->>'stripe_checkout_session_id';
  if v_existing_id is not null then
    return jsonb_build_object('order_id', v_existing_id, 'existing', true, 'unfulfilled_item_ids', '[]'::jsonb);
  end if;

  insert into orders (
    stripe_checkout_session_id, stripe_payment_intent_id, status, fulfillment, locale,
    customer_name, customer_email, customer_phone, shipping_address,
    subtotal_cents, shipping_cents, tax_cents, total_cents
  ) values (
    v_order->>'stripe_checkout_session_id',
    v_order->>'stripe_payment_intent_id',
    (v_order->>'status')::order_status,
    (v_order->>'fulfillment')::fulfillment_type,
    v_order->>'locale',
    v_order->>'customer_name',
    v_order->>'customer_email',
    v_order->>'customer_phone',
    v_order->'shipping_address',
    (v_order->>'subtotal_cents')::int,
    (v_order->>'shipping_cents')::int,
    (v_order->>'tax_cents')::int,
    (v_order->>'total_cents')::int
  )
  returning id into v_order_id;

  for v_item in select * from jsonb_array_elements(v_items)
  loop
    insert into order_items (
      order_id, variant_id, design_id, name_snapshot, variant_label_snapshot, unit_price_cents, qty
    ) values (
      v_order_id,
      (v_item->>'variant_id')::uuid,
      (v_item->>'design_id')::uuid,
      v_item->>'name_snapshot',
      v_item->>'variant_label_snapshot',
      (v_item->>'unit_price_cents')::int,
      (v_item->>'qty')::int
    )
    returning id into v_item_id;

    begin
      perform adjust_inventory((v_item->>'variant_id')::uuid, -(v_item->>'qty')::int, 'online_order', v_order_id, null);
    exception
      when sqlstate 'P0001' then
        update order_items set fulfilled = false where id = v_item_id;
        v_unfulfilled := v_unfulfilled || jsonb_build_array(v_item_id::text);
    end;
  end loop;

  return jsonb_build_object('order_id', v_order_id, 'existing', false, 'unfulfilled_item_ids', v_unfulfilled);
end;
$$;
revoke execute on function create_order_from_checkout(jsonb) from public, anon, authenticated;
