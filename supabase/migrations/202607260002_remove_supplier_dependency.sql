alter table public.products
  alter column supplier_id drop not null;

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
      null,
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
      supplier_id = null,
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
    null,
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
