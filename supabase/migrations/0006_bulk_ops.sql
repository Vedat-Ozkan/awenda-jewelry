-- Bulk restock (Phase 4 step 8): +p_qty to every variant of the given
-- designs, in one transaction, via adjust_inventory() so the ledger stays
-- consistent (one 'restock' movement per variant). security definer +
-- revoked from public/anon/authenticated, same posture as adjust_inventory()
-- itself (0003_functions.sql) — only the service client calls this.
create function bulk_restock(p_design_ids uuid[], p_qty int, p_note text default null)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_variant record;
  v_count int := 0;
begin
  for v_variant in
    select v.id, v.design_id from variants v where v.design_id = any(p_design_ids)
  loop
    perform adjust_inventory(v_variant.id, p_qty, 'restock', v_variant.design_id, p_note);
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;
revoke execute on function bulk_restock(uuid[], int, text) from public, anon, authenticated;
