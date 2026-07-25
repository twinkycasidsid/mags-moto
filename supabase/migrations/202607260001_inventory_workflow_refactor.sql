create table if not exists public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete restrict,
  movement_type text not null check (movement_type in ('stock_in', 'adjustment', 'sale', 'sale_void')),
  previous_stock integer not null,
  quantity_changed integer not null,
  new_stock integer not null,
  unit_cost numeric(12,2),
  reference_number text,
  notes text,
  related_transaction_id uuid references public.transactions(id) on delete set null,
  related_adjustment_id uuid references public.stock_adjustments(id) on delete set null,
  related_receiving_record_id uuid references public.stock_receiving_records(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint inventory_movements_stock_check check (
    new_stock = previous_stock + quantity_changed
  )
);

alter table public.inventory_movements enable row level security;

create policy "Authenticated users can read inventory movements"
on public.inventory_movements
for select
to authenticated
using (true);

alter table public.stock_receiving_records
  alter column supplier_id drop not null;

alter table public.stock_adjustments
  drop constraint if exists stock_adjustments_adjustment_type_check;

alter table public.stock_adjustments
  add constraint stock_adjustments_adjustment_type_check
  check (adjustment_type in ('increase', 'decrease'));

alter table public.stock_adjustments
  drop constraint if exists stock_adjustments_reason_check;

alter table public.stock_adjustments
  add constraint stock_adjustments_reason_check
  check (reason in ('damaged', 'lost', 'returned', 'physical_count_correction', 'shop_use', 'encoding_error', 'other'));

create or replace function public.upsert_product(p_payload jsonb)
returns public.products
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_product public.products;
  v_product_id uuid := nullif(p_payload->>'id', '')::uuid;
  v_name text := trim(coalesce(p_payload->>'name', ''));
  v_stock integer := greatest(0, coalesce((p_payload->>'currentStock')::integer, 0));
  v_reorder_level integer := public.calculate_low_stock_level(v_stock);
  v_total_purchase_cost numeric := round(coalesce((p_payload->>'totalPurchaseCost')::numeric, 0), 2);
  v_unit_cost numeric;
  v_existing_stock integer;
  v_existing_cost numeric(12,2);
  v_existing_reorder integer;
begin
  if not public.is_admin() then
    raise exception 'Forbidden';
  end if;

  if v_name = '' then
    raise exception 'Product name is required.';
  end if;

  if nullif(trim(coalesce(p_payload->>'categoryId', '')), '') is null then
    raise exception 'Category is required.';
  end if;

  if nullif(trim(coalesce(p_payload->>'supplierId', '')), '') is null then
    raise exception 'Supplier is required.';
  end if;

  if v_product_id is null then
    v_unit_cost := public.calculate_unit_cost(v_total_purchase_cost, v_stock);

    insert into public.products (
      sku,
      barcode,
      name,
      description,
      category_id,
      supplier_id,
      unit,
      cost_price,
      selling_price,
      current_stock,
      reorder_level,
      max_stock,
      status
    )
    values (
      public.generate_product_sku(),
      null,
      v_name,
      nullif(trim(coalesce(p_payload->>'description', '')), ''),
      (p_payload->>'categoryId')::uuid,
      (p_payload->>'supplierId')::uuid,
      trim(coalesce(p_payload->>'unit', 'pc')),
      v_unit_cost,
      greatest(0, coalesce((p_payload->>'sellingPrice')::numeric, 0)),
      v_stock,
      v_reorder_level,
      nullif(p_payload->>'maxStock', '')::integer,
      coalesce(nullif(p_payload->>'status', ''), 'active')
    )
    returning * into v_product;

    perform public.admin_insert_audit_log(
      v_actor_id,
      'Product Added',
      v_product.name,
      format(
        'SKU: %s | Sell price: %s | Opening stock: %s | Low stock alert: %s',
        v_product.sku,
        v_product.selling_price,
        v_product.current_stock,
        v_product.reorder_level
      )
    );
  else
    select current_stock, cost_price, reorder_level
    into v_existing_stock, v_existing_cost, v_existing_reorder
    from public.products
    where id = v_product_id;

    if not found then
      raise exception 'Product not found.';
    end if;

    update public.products
    set
      name = v_name,
      description = nullif(trim(coalesce(p_payload->>'description', '')), ''),
      category_id = (p_payload->>'categoryId')::uuid,
      supplier_id = (p_payload->>'supplierId')::uuid,
      unit = trim(coalesce(p_payload->>'unit', unit)),
      selling_price = greatest(0, coalesce((p_payload->>'sellingPrice')::numeric, 0)),
      current_stock = v_existing_stock,
      cost_price = v_existing_cost,
      reorder_level = v_existing_reorder,
      max_stock = nullif(p_payload->>'maxStock', '')::integer,
      status = coalesce(nullif(p_payload->>'status', ''), status)
    where id = v_product_id
    returning * into v_product;

    perform public.admin_insert_audit_log(
      v_actor_id,
      'Product Edited',
      v_product.name,
      format(
        'SKU: %s | Sell price: %s | Product information updated without changing stock',
        v_product.sku,
        v_product.selling_price
      )
    );
  end if;

  return v_product;
end;
$$;

create or replace function public.receive_stock_delivery(p_payload jsonb)
returns public.stock_receiving_records
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_record public.stock_receiving_records;
  v_product public.products;
  v_quantity integer := greatest(1, coalesce((p_payload->>'quantityReceived')::integer, 0));
  v_total_purchase_cost numeric(12,2) := round(coalesce((p_payload->>'totalPurchaseCost')::numeric, 0), 2);
  v_unit_cost numeric(12,2);
  v_previous_stock integer;
  v_new_stock integer;
  v_new_average_cost numeric(12,2);
begin
  if not public.is_admin() then
    raise exception 'Forbidden';
  end if;

  if nullif(trim(coalesce(p_payload->>'productId', '')), '') is null then
    raise exception 'Product is required.';
  end if;

  if v_total_purchase_cost <= 0 then
    raise exception 'Total purchase cost must be greater than zero.';
  end if;

  v_unit_cost := public.calculate_unit_cost(v_total_purchase_cost, v_quantity);

  select *
  into v_product
  from public.products
  where id = (p_payload->>'productId')::uuid
  for update;

  if not found then
    raise exception 'Product not found.';
  end if;

  v_previous_stock := v_product.current_stock;
  v_new_stock := v_previous_stock + v_quantity;
  v_new_average_cost := round(
    (
      (greatest(v_previous_stock, 0)::numeric * v_product.cost_price) +
      (v_quantity::numeric * v_unit_cost)
    ) / greatest(v_new_stock, 1),
    2
  );

  insert into public.stock_receiving_records (
    reference_number,
    supplier_id,
    delivery_date,
    total_amount,
    notes,
    recorded_by
  )
  values (
    trim(coalesce(p_payload->>'referenceNumber', '')),
    nullif(p_payload->>'supplierId', '')::uuid,
    coalesce(nullif(p_payload->>'deliveryDate', '')::date, current_date),
    v_total_purchase_cost,
    nullif(trim(coalesce(p_payload->>'notes', '')), ''),
    v_actor_id
  )
  returning * into v_record;

  insert into public.stock_receiving_items (
    receiving_record_id,
    product_id,
    quantity_received,
    unit_cost,
    total_cost
  )
  values (
    v_record.id,
    v_product.id,
    v_quantity,
    v_unit_cost,
    v_total_purchase_cost
  );

  update public.products
  set
    current_stock = v_new_stock,
    cost_price = v_new_average_cost
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
    related_receiving_record_id,
    created_by
  )
  values (
    v_product.id,
    'stock_in',
    v_previous_stock,
    v_quantity,
    v_new_stock,
    v_unit_cost,
    nullif(trim(coalesce(p_payload->>'referenceNumber', '')), ''),
    nullif(trim(coalesce(p_payload->>'notes', '')), ''),
    v_record.id,
    v_actor_id
  );

  perform public.admin_insert_audit_log(
    v_actor_id,
    'Stock Added',
    v_product.name,
    format(
      'Received %s units. Previous stock: %s | New stock: %s | New average cost: %s',
      v_quantity,
      v_previous_stock,
      v_new_stock,
      v_new_average_cost
    )
  );

  return v_record;
end;
$$;

create or replace function public.adjust_inventory_stock(p_payload jsonb)
returns public.stock_adjustments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_product public.products;
  v_quantity integer := greatest(1, coalesce((p_payload->>'quantity')::integer, 0));
  v_adjustment_type text := lower(trim(coalesce(p_payload->>'adjustmentType', '')));
  v_reason text := lower(trim(coalesce(p_payload->>'reason', '')));
  v_new_stock integer;
  v_adjustment public.stock_adjustments;
begin
  if not public.is_admin() then
    raise exception 'Forbidden';
  end if;

  if v_reason not in ('damaged', 'lost', 'returned', 'physical_count_correction', 'shop_use', 'encoding_error', 'other') then
    raise exception 'A valid adjustment reason is required.';
  end if;

  if v_adjustment_type not in ('increase', 'decrease') then
    raise exception 'Invalid adjustment type.';
  end if;

  select * into v_product
  from public.products
  where id = (p_payload->>'productId')::uuid
  for update;

  if not found then
    raise exception 'Product not found.';
  end if;

  v_new_stock := case
    when v_adjustment_type = 'increase' then v_product.current_stock + v_quantity
    else v_product.current_stock - v_quantity
  end;

  if v_new_stock < 0 then
    raise exception 'Cannot reduce stock below zero.';
  end if;

  update public.products
  set current_stock = v_new_stock
  where id = v_product.id;

  insert into public.stock_adjustments (
    product_id,
    adjustment_type,
    quantity,
    reason,
    previous_stock,
    new_stock,
    notes,
    adjusted_by
  )
  values (
    v_product.id,
    v_adjustment_type,
    v_quantity,
    v_reason,
    v_product.current_stock,
    v_new_stock,
    nullif(trim(coalesce(p_payload->>'notes', '')), ''),
    v_actor_id
  )
  returning * into v_adjustment;

  insert into public.inventory_movements (
    product_id,
    movement_type,
    previous_stock,
    quantity_changed,
    new_stock,
    reference_number,
    notes,
    related_adjustment_id,
    created_by
  )
  values (
    v_product.id,
    'adjustment',
    v_product.current_stock,
    case when v_adjustment_type = 'increase' then v_quantity else -v_quantity end,
    v_new_stock,
    null,
    trim(v_reason || coalesce(case when nullif(trim(coalesce(p_payload->>'notes', '')), '') is not null then ' | ' || trim(p_payload->>'notes') else '' end, '')),
    v_adjustment.id,
    v_actor_id
  );

  perform public.admin_insert_audit_log(
    v_actor_id,
    'Inventory Adjustment',
    v_product.name,
    format(
      '%s adjustment of %s units. Previous stock: %s | New stock: %s | Reason: %s',
      initcap(v_adjustment_type),
      v_quantity,
      v_product.current_stock,
      v_new_stock,
      v_reason
    )
  );

  return v_adjustment;
end;
$$;

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
  v_receipt_number text := format('RCP-%s', to_char(timezone('utc', now()), 'YYYYMMDDHH24MISSMS'));
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

create or replace function public.void_sale_transaction(
  p_transaction_id uuid,
  p_reason text
)
returns public.transactions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_tx public.transactions;
  v_item public.transaction_items;
  v_product public.products;
  v_previous_stock integer;
  v_new_stock integer;
begin
  if not public.is_admin() then
    raise exception 'Forbidden';
  end if;

  if coalesce(trim(p_reason), '') = '' then
    raise exception 'Void reason is required.';
  end if;

  select * into v_tx from public.transactions where id = p_transaction_id for update;
  if not found then
    raise exception 'Transaction not found.';
  end if;

  if v_tx.status <> 'completed' then
    raise exception 'Only completed sales can be voided.';
  end if;

  for v_item in
    select * from public.transaction_items where transaction_id = p_transaction_id
  loop
    select * into v_product
    from public.products
    where id = v_item.product_id
    for update;

    v_previous_stock := v_product.current_stock;
    v_new_stock := v_previous_stock + v_item.quantity;

    update public.products
    set current_stock = v_new_stock
    where id = v_item.product_id;

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
      v_item.product_id,
      'sale_void',
      v_previous_stock,
      v_item.quantity,
      v_new_stock,
      v_item.cost_price,
      v_tx.receipt_number,
      trim(p_reason),
      v_tx.id,
      v_actor_id
    );
  end loop;

  update public.transactions
  set
    status = 'voided',
    void_reason = trim(p_reason)
  where id = p_transaction_id
  returning * into v_tx;

  perform public.admin_insert_audit_log(
    v_actor_id,
    'Sale Voided',
    v_tx.receipt_number,
    format('Voided transaction of %s. Reason: %s', v_tx.grand_total, trim(p_reason))
  );

  return v_tx;
end;
$$;

create or replace function public.delete_product(p_product_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_product public.products;
begin
  if not public.is_admin() then
    raise exception 'Forbidden';
  end if;

  select * into v_product
  from public.products
  where id = p_product_id;

  if not found then
    raise exception 'Product not found.';
  end if;

  if exists (select 1 from public.transaction_items where product_id = p_product_id)
     or exists (select 1 from public.stock_receiving_items where product_id = p_product_id)
     or exists (select 1 from public.stock_adjustments where product_id = p_product_id)
     or exists (select 1 from public.inventory_movements where product_id = p_product_id) then
    raise exception 'Product cannot be deleted because it already has sales or inventory history.';
  end if;

  delete from public.products
  where id = p_product_id;

  perform public.admin_insert_audit_log(
    v_actor_id,
    'Product Deleted',
    v_product.name,
    format('Deleted unused product with SKU %s', v_product.sku)
  );
end;
$$;

grant execute on function public.delete_product(uuid) to authenticated;
