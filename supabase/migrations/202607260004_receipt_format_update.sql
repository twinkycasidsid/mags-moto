create or replace function public.record_sale(p_payload jsonb)
returns public.transactions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_allow_negative boolean := false;
  v_subtotal numeric(12,2) := 0;
  v_discount_total numeric(12,2) := greatest(0, coalesce((p_payload->>'discountTotal')::numeric, 0));
  v_grand_total numeric(12,2);
  v_total_cost numeric(12,2) := 0;
  v_amount_received numeric(12,2) := greatest(0, coalesce((p_payload->>'amountReceived')::numeric, 0));
  v_change_given numeric(12,2);
  v_receipt_date text := to_char(timezone('Asia/Manila', now()), 'YYMMDD');
  v_receipt_sequence integer;
  v_receipt_number text;
  v_tx public.transactions;
  v_item jsonb;
  v_product public.products;
  v_quantity integer;
  v_previous_stock integer;
  v_new_stock integer;
begin
  if public.current_profile_role() not in ('admin', 'cashier') then
    raise exception 'Forbidden';
  end if;

  select allow_negative_stock into v_allow_negative from public.store_settings where id = 1;

  if jsonb_typeof(p_payload->'items') <> 'array' or jsonb_array_length(p_payload->'items') = 0 then
    raise exception 'Sale must contain at least one item.';
  end if;

  for v_item in select * from jsonb_array_elements(p_payload->'items')
  loop
    v_quantity := greatest(1, coalesce((v_item->>'quantity')::integer, 0));

    select * into v_product
    from public.products
    where id = (v_item->>'productId')::uuid
    for update;

    if not found or v_product.status <> 'active' then
      raise exception 'Product is unavailable.';
    end if;

    if not v_allow_negative and v_product.current_stock < v_quantity then
      raise exception 'Insufficient stock for %', v_product.name;
    end if;

    v_subtotal := v_subtotal + (v_product.selling_price * v_quantity);
    v_total_cost := v_total_cost + (v_product.cost_price * v_quantity);
  end loop;

  v_discount_total := least(v_discount_total, v_subtotal);
  v_grand_total := v_subtotal - v_discount_total;

  if v_amount_received < v_grand_total then
    raise exception 'Amount received is less than grand total.';
  end if;

  v_change_given := greatest(0, v_amount_received - v_grand_total);

  perform pg_advisory_xact_lock(hashtext(v_receipt_date));

  select count(*) + 1
  into v_receipt_sequence
  from public.transactions
  where receipt_number like v_receipt_date || '%';

  v_receipt_number := v_receipt_date || lpad(v_receipt_sequence::text, 4, '0');

  insert into public.transactions (
    receipt_number,
    sold_at,
    cashier_id,
    subtotal,
    discount_total,
    tax_total,
    grand_total,
    total_cost,
    estimated_profit,
    payment_method,
    amount_received,
    change_given,
    status
  )
  values (
    v_receipt_number,
    timezone('utc', now()),
    v_actor_id,
    v_subtotal,
    v_discount_total,
    0,
    v_grand_total,
    v_total_cost,
    v_grand_total - v_total_cost,
    p_payload->>'paymentMethod',
    v_amount_received,
    v_change_given,
    'completed'
  )
  returning * into v_tx;

  for v_item in select * from jsonb_array_elements(p_payload->'items')
  loop
    v_quantity := greatest(1, coalesce((v_item->>'quantity')::integer, 0));

    select * into v_product
    from public.products
    where id = (v_item->>'productId')::uuid
    for update;

    v_previous_stock := v_product.current_stock;
    v_new_stock := v_previous_stock - v_quantity;

    insert into public.transaction_items (
      transaction_id,
      product_id,
      product_name,
      quantity,
      unit_price,
      cost_price,
      discount,
      subtotal
    )
    values (
      v_tx.id,
      v_product.id,
      v_product.name,
      v_quantity,
      v_product.selling_price,
      v_product.cost_price,
      0,
      v_product.selling_price * v_quantity
    );

    update public.products
    set current_stock = v_new_stock
    where id = v_product.id;

    insert into public.inventory_movements (
      product_id,
      movement_type,
      previous_stock,
      quantity_changed,
      new_stock,
      unit_cost,
      reference_number,
      notes,
      related_transaction_id,
      created_by
    )
    values (
      v_product.id,
      'sale',
      v_previous_stock,
      -v_quantity,
      v_new_stock,
      v_product.cost_price,
      v_tx.receipt_number,
      format('POS sale recorded via %s', upper(v_tx.payment_method)),
      v_tx.id,
      v_actor_id
    );
  end loop;

  perform public.admin_insert_audit_log(
    v_actor_id,
    'Sale Completed',
    v_tx.receipt_number,
    format('Completed %s transaction for %s', upper(v_tx.payment_method), v_tx.grand_total)
  );

  return v_tx;
end;
$$;
