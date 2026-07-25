alter table public.products
  alter column barcode drop not null;

create or replace function public.calculate_low_stock_level(p_stock integer)
returns integer
language sql
immutable
as $$
  select greatest(1, ceil(greatest(0, coalesce(p_stock, 0)) * 0.30)::integer);
$$;

create or replace function public.calculate_unit_cost(
  p_total_purchase_cost numeric,
  p_stock integer
)
returns numeric
language plpgsql
immutable
as $$
declare
  v_total numeric := round(coalesce(p_total_purchase_cost, 0)::numeric, 2);
  v_stock integer := coalesce(p_stock, 0);
begin
  if v_total <= 0 then
    raise exception 'Total purchase cost must be greater than zero.';
  end if;

  if v_stock <= 0 then
    raise exception 'Initial stock quantity must be greater than zero.';
  end if;

  return round(v_total / v_stock, 2);
end;
$$;

create or replace function public.generate_product_sku()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sku text;
begin
  loop
    v_sku := 'SKU-' || upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 12));
    exit when not exists (select 1 from public.products where sku = v_sku);
  end loop;

  return v_sku;
end;
$$;

create or replace function public.create_product_category(p_payload jsonb)
returns public.categories
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_name text := trim(coalesce(p_payload->>'name', ''));
  v_category public.categories;
begin
  if not public.is_admin() then
    raise exception 'Forbidden';
  end if;

  if v_name = '' then
    raise exception 'Category name is required.';
  end if;

  if exists (
    select 1
    from public.categories
    where lower(name) = lower(v_name)
  ) then
    raise exception 'Category already exists.';
  end if;

  insert into public.categories (name, description)
  values (
    v_name,
    nullif(trim(coalesce(p_payload->>'description', '')), '')
  )
  returning * into v_category;

  perform public.admin_insert_audit_log(
    v_actor_id,
    'Category Created',
    v_category.name,
    'Created product category'
  );

  return v_category;
end;
$$;

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
      format('SKU: %s | Price: %s | Stock: %s | Low stock alert: %s', v_product.sku, v_product.selling_price, v_product.current_stock, v_product.reorder_level)
    );
  else
    update public.products
    set
      name = v_name,
      description = nullif(trim(coalesce(p_payload->>'description', '')), ''),
      category_id = (p_payload->>'categoryId')::uuid,
      supplier_id = (p_payload->>'supplierId')::uuid,
      unit = trim(coalesce(p_payload->>'unit', unit)),
      selling_price = greatest(0, coalesce((p_payload->>'sellingPrice')::numeric, 0)),
      current_stock = v_stock,
      reorder_level = v_reorder_level,
      max_stock = nullif(p_payload->>'maxStock', '')::integer,
      status = coalesce(nullif(p_payload->>'status', ''), status)
    where id = v_product_id
    returning * into v_product;

    if not found then
      raise exception 'Product not found.';
    end if;

    perform public.admin_insert_audit_log(
      v_actor_id,
      'Product Edited',
      v_product.name,
      format('SKU: %s | Price: %s | Stock: %s | Low stock alert: %s', v_product.sku, v_product.selling_price, v_product.current_stock, v_product.reorder_level)
    );
  end if;

  return v_product;
end;
$$;
