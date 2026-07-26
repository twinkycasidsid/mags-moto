create or replace function public.normalize_product_name(p_name text)
returns text
language sql
immutable
as $$
  select lower(regexp_replace(trim(coalesce(p_name, '')), '\s+', ' ', 'g'));
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
  v_name text := regexp_replace(trim(coalesce(p_payload->>'name', '')), '\s+', ' ', 'g');
  v_description text := nullif(trim(coalesce(p_payload->>'description', '')), '');
  v_stock integer := greatest(0, coalesce((p_payload->>'currentStock')::integer, 0));
  v_reorder_level integer := public.calculate_low_stock_level(v_stock);
  v_total_purchase_cost numeric := round(coalesce((p_payload->>'totalPurchaseCost')::numeric, 0), 2);
  v_unit text := trim(coalesce(p_payload->>'unit', 'pc'));
  v_selling_price numeric(12,2) := round(greatest(0, coalesce((p_payload->>'sellingPrice')::numeric, 0)), 2);
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

  if char_length(v_name) > 160 then
    raise exception 'Product name must be 160 characters or fewer.';
  end if;

  if v_description is not null and char_length(v_description) > 500 then
    raise exception 'Product description must be 500 characters or fewer.';
  end if;

  if nullif(trim(coalesce(p_payload->>'categoryId', '')), '') is null then
    raise exception 'Category is required.';
  end if;

  if v_unit = '' then
    raise exception 'Unit of measurement is required.';
  end if;

  if v_selling_price <= 0 then
    raise exception 'Selling price must be greater than zero.';
  end if;

  if exists (
    select 1
    from public.products
    where public.normalize_product_name(name) = public.normalize_product_name(v_name)
      and id <> coalesce(v_product_id, '00000000-0000-0000-0000-000000000000'::uuid)
  ) then
    raise exception 'A product with this name already exists.';
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
      v_description,
      (p_payload->>'categoryId')::uuid,
      null,
      v_unit,
      v_unit_cost,
      v_selling_price,
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
      description = v_description,
      category_id = (p_payload->>'categoryId')::uuid,
      supplier_id = null,
      unit = trim(coalesce(p_payload->>'unit', unit)),
      selling_price = v_selling_price,
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

create or replace function public.record_expense(p_payload jsonb)
returns public.expenses
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_expense public.expenses;
  v_category text := regexp_replace(trim(coalesce(p_payload->>'category', '')), '\s+', ' ', 'g');
  v_description text := regexp_replace(trim(coalesce(p_payload->>'description', '')), '\s+', ' ', 'g');
  v_amount numeric(12,2) := round(coalesce((p_payload->>'amount')::numeric, 0), 2);
begin
  if not public.is_admin() then
    raise exception 'Forbidden';
  end if;

  if v_category = '' then
    raise exception 'Expense category is required.';
  end if;

  if char_length(v_category) > 120 then
    raise exception 'Expense category must be 120 characters or fewer.';
  end if;

  if v_description = '' then
    raise exception 'Type of expense is required.';
  end if;

  if char_length(v_description) > 160 then
    raise exception 'Type of expense must be 160 characters or fewer.';
  end if;

  if v_amount <= 0 then
    raise exception 'Expense amount must be greater than zero.';
  end if;

  insert into public.expenses (
    category,
    description,
    amount,
    expense_date,
    reference_number,
    recorded_by
  )
  values (
    v_category,
    v_description,
    v_amount,
    coalesce(nullif(p_payload->>'date', '')::date, current_date),
    nullif(trim(p_payload->>'referenceNumber'), ''),
    v_actor_id
  )
  returning * into v_expense;

  perform public.admin_insert_audit_log(
    v_actor_id,
    'Expense Logged',
    v_expense.category,
    format('Recorded overhead expense of %s: %s', v_expense.amount, v_expense.description)
  );

  return v_expense;
end;
$$;

create or replace function public.update_expense(
  p_expense_id uuid,
  p_payload jsonb
)
returns public.expenses
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_expense public.expenses;
  v_category text := regexp_replace(trim(coalesce(p_payload->>'category', '')), '\s+', ' ', 'g');
  v_type_of_expense text := regexp_replace(trim(coalesce(p_payload->>'description', '')), '\s+', ' ', 'g');
  v_amount numeric(12,2) := round(coalesce((p_payload->>'amount')::numeric, 0), 2);
begin
  if not public.is_admin() then
    raise exception 'Forbidden';
  end if;

  if v_category = '' then
    raise exception 'Expense category is required.';
  end if;

  if char_length(v_category) > 120 then
    raise exception 'Expense category must be 120 characters or fewer.';
  end if;

  if v_type_of_expense = '' then
    raise exception 'Type of expense is required.';
  end if;

  if char_length(v_type_of_expense) > 160 then
    raise exception 'Type of expense must be 160 characters or fewer.';
  end if;

  if v_amount <= 0 then
    raise exception 'Expense amount must be greater than zero.';
  end if;

  update public.expenses
  set
    category = v_category,
    description = v_type_of_expense,
    amount = v_amount,
    reference_number = nullif(trim(coalesce(p_payload->>'referenceNumber', '')), '')
  where id = p_expense_id
  returning * into v_expense;

  if not found then
    raise exception 'Expense not found.';
  end if;

  perform public.admin_insert_audit_log(
    v_actor_id,
    'Expense Updated',
    v_expense.category,
    format('Updated expense %s for %s', v_expense.description, v_expense.amount)
  );

  return v_expense;
end;
$$;

create or replace function public.save_store_settings(p_payload jsonb)
returns public.store_settings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_settings public.store_settings;
  v_store_name text := regexp_replace(trim(coalesce(p_payload->>'storeName', '')), '\s+', ' ', 'g');
begin
  if not public.is_admin() then
    raise exception 'Forbidden';
  end if;

  if v_store_name = '' then
    raise exception 'Store name is required.';
  end if;

  if char_length(v_store_name) > 120 then
    raise exception 'Store name must be 120 characters or fewer.';
  end if;

  insert into public.store_settings (
    id,
    store_name,
    store_logo,
    address,
    phone,
    email,
    currency_symbol,
    tax_rate,
    allow_negative_stock,
    receipt_footer
  )
  values (
    1,
    v_store_name,
    nullif(trim(p_payload->>'storeLogo'), ''),
    nullif(trim(p_payload->>'address'), ''),
    nullif(trim(p_payload->>'phone'), ''),
    nullif(trim(p_payload->>'email'), ''),
    coalesce(nullif(trim(p_payload->>'currencySymbol'), ''), 'â‚±'),
    coalesce(nullif(p_payload->>'taxRate', '')::numeric, 0),
    coalesce((p_payload->>'allowNegativeStock')::boolean, false),
    nullif(trim(p_payload->>'receiptFooter'), '')
  )
  on conflict (id) do update
  set
    store_name = excluded.store_name,
    store_logo = excluded.store_logo,
    address = excluded.address,
    phone = excluded.phone,
    email = excluded.email,
    currency_symbol = excluded.currency_symbol,
    tax_rate = excluded.tax_rate,
    allow_negative_stock = excluded.allow_negative_stock,
    receipt_footer = excluded.receipt_footer
  returning * into v_settings;

  perform public.admin_insert_audit_log(
    v_actor_id,
    'Store Settings Modified',
    v_settings.store_name,
    'Updated store configuration'
  );

  return v_settings;
end;
$$;
