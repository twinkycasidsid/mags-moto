create extension if not exists pgcrypto;
create extension if not exists citext;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'app_role') then
    create type public.app_role as enum ('admin', 'cashier');
  end if;
end
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username citext not null unique,
  name text not null,
  role public.app_role not null,
  active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.store_settings (
  id integer primary key default 1 check (id = 1),
  store_name text not null,
  store_logo text,
  address text,
  phone text,
  email text,
  currency_symbol text not null default '₱',
  tax_rate numeric(5,2) not null default 0,
  allow_negative_stock boolean not null default false,
  receipt_footer text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  contact_person text not null,
  phone text,
  email text,
  address text,
  active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  sku text not null unique,
  barcode text not null unique,
  name text not null,
  description text,
  category_id uuid not null references public.categories(id) on delete restrict,
  supplier_id uuid not null references public.suppliers(id) on delete restrict,
  unit text not null,
  cost_price numeric(12,2) not null check (cost_price >= 0),
  selling_price numeric(12,2) not null check (selling_price >= 0),
  current_stock integer not null default 0,
  reorder_level integer not null default 0 check (reorder_level >= 0),
  max_stock integer,
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  receipt_number text not null unique,
  sold_at timestamptz not null default timezone('utc', now()),
  cashier_id uuid not null references public.profiles(id) on delete restrict,
  subtotal numeric(12,2) not null check (subtotal >= 0),
  discount_total numeric(12,2) not null default 0 check (discount_total >= 0),
  tax_total numeric(12,2) not null default 0 check (tax_total >= 0),
  grand_total numeric(12,2) not null check (grand_total >= 0),
  total_cost numeric(12,2) not null check (total_cost >= 0),
  estimated_profit numeric(12,2) not null,
  payment_method text not null check (payment_method in ('cash', 'gcash')),
  amount_received numeric(12,2) not null check (amount_received >= 0),
  change_given numeric(12,2) not null default 0 check (change_given >= 0),
  status text not null default 'completed' check (status in ('completed', 'voided', 'refunded')),
  void_reason text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.transaction_items (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.transactions(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  product_name text not null,
  quantity integer not null check (quantity > 0),
  unit_price numeric(12,2) not null check (unit_price >= 0),
  cost_price numeric(12,2) not null check (cost_price >= 0),
  discount numeric(12,2) not null default 0 check (discount >= 0),
  subtotal numeric(12,2) not null check (subtotal >= 0),
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.stock_receiving_records (
  id uuid primary key default gen_random_uuid(),
  reference_number text not null unique,
  supplier_id uuid not null references public.suppliers(id) on delete restrict,
  delivery_date date not null,
  total_amount numeric(12,2) not null check (total_amount >= 0),
  notes text,
  recorded_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.stock_receiving_items (
  id uuid primary key default gen_random_uuid(),
  receiving_record_id uuid not null references public.stock_receiving_records(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  quantity_received integer not null check (quantity_received > 0),
  unit_cost numeric(12,2) not null check (unit_cost >= 0),
  total_cost numeric(12,2) not null check (total_cost >= 0),
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.stock_adjustments (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete restrict,
  adjustment_type text not null check (adjustment_type in ('add', 'remove')),
  quantity integer not null check (quantity > 0),
  reason text not null check (reason in ('damaged', 'expired', 'lost', 'returned', 'correction', 'personal_use')),
  previous_stock integer not null,
  new_stock integer not null,
  notes text,
  adjusted_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  description text not null,
  amount numeric(12,2) not null check (amount > 0),
  expense_date date not null default current_date,
  reference_number text,
  recorded_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  user_name text not null,
  action text not null,
  affected_record text not null,
  details text not null,
  created_at timestamptz not null default timezone('utc', now())
);

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger settings_set_updated_at
before update on public.store_settings
for each row execute function public.set_updated_at();

create trigger categories_set_updated_at
before update on public.categories
for each row execute function public.set_updated_at();

create trigger suppliers_set_updated_at
before update on public.suppliers
for each row execute function public.set_updated_at();

create trigger products_set_updated_at
before update on public.products
for each row execute function public.set_updated_at();

create trigger transactions_set_updated_at
before update on public.transactions
for each row execute function public.set_updated_at();

create trigger receiving_set_updated_at
before update on public.stock_receiving_records
for each row execute function public.set_updated_at();

create trigger expenses_set_updated_at
before update on public.expenses
for each row execute function public.set_updated_at();

create or replace function public.current_profile_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role::text
  from public.profiles
  where id = auth.uid()
    and active = true;
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_profile_role() = 'admin', false);
$$;

create or replace function public.current_profile_name()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select name
  from public.profiles
  where id = auth.uid()
    and active = true;
$$;

create or replace function public.admin_insert_audit_log(
  p_actor_id uuid,
  p_action text,
  p_affected_record text,
  p_details text
)
returns public.audit_logs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_name text;
  v_log public.audit_logs;
begin
  select name into v_user_name from public.profiles where id = p_actor_id;

  insert into public.audit_logs (
    actor_id,
    user_name,
    action,
    affected_record,
    details
  )
  values (
    p_actor_id,
    coalesce(v_user_name, 'System'),
    p_action,
    p_affected_record,
    p_details
  )
  returning * into v_log;

  return v_log;
end;
$$;

create or replace function public.record_session_event(p_action text)
returns public.audit_logs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
begin
  if v_actor_id is null then
    raise exception 'Unauthorized';
  end if;

  if p_action not in ('User Login', 'User Logout') then
    raise exception 'Invalid session action.';
  end if;

  return public.admin_insert_audit_log(
    v_actor_id,
    p_action,
    'Session',
    case
      when p_action = 'User Login'
        then format('User %s (%s) logged into system', public.current_profile_name(), upper(public.current_profile_role()))
      else format('User %s logged out from the system', public.current_profile_name())
    end
  );
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
begin
  if not public.is_admin() then
    raise exception 'Forbidden';
  end if;

  if coalesce(trim(p_payload->>'name'), '') = '' then
    raise exception 'Product name is required.';
  end if;

  if v_product_id is null then
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
      trim(p_payload->>'sku'),
      trim(p_payload->>'barcode'),
      trim(p_payload->>'name'),
      nullif(trim(p_payload->>'description'), ''),
      (p_payload->>'categoryId')::uuid,
      (p_payload->>'supplierId')::uuid,
      trim(p_payload->>'unit'),
      greatest(0, (p_payload->>'costPrice')::numeric),
      greatest(0, (p_payload->>'sellingPrice')::numeric),
      (p_payload->>'currentStock')::integer,
      greatest(0, (p_payload->>'reorderLevel')::integer),
      nullif(p_payload->>'maxStock', '')::integer,
      coalesce(nullif(p_payload->>'status', ''), 'active')
    )
    returning * into v_product;

    perform public.admin_insert_audit_log(
      v_actor_id,
      'Product Added',
      v_product.name,
      format('SKU: %s | Price: %s | Stock: %s', v_product.sku, v_product.selling_price, v_product.current_stock)
    );
  else
    update public.products
    set
      sku = trim(p_payload->>'sku'),
      barcode = trim(p_payload->>'barcode'),
      name = trim(p_payload->>'name'),
      description = nullif(trim(p_payload->>'description'), ''),
      category_id = (p_payload->>'categoryId')::uuid,
      supplier_id = (p_payload->>'supplierId')::uuid,
      unit = trim(p_payload->>'unit'),
      cost_price = greatest(0, (p_payload->>'costPrice')::numeric),
      selling_price = greatest(0, (p_payload->>'sellingPrice')::numeric),
      current_stock = (p_payload->>'currentStock')::integer,
      reorder_level = greatest(0, (p_payload->>'reorderLevel')::integer),
      max_stock = nullif(p_payload->>'maxStock', '')::integer,
      status = coalesce(nullif(p_payload->>'status', ''), 'active')
    where id = v_product_id
    returning * into v_product;

    perform public.admin_insert_audit_log(
      v_actor_id,
      'Product Edited',
      v_product.name,
      format('SKU: %s | Price: %s | Stock: %s', v_product.sku, v_product.selling_price, v_product.current_stock)
    );
  end if;

  return v_product;
end;
$$;

create or replace function public.toggle_product_status(p_product_id uuid)
returns public.products
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_product public.products;
  v_next_status text;
begin
  if not public.is_admin() then
    raise exception 'Forbidden';
  end if;

  select * into v_product from public.products where id = p_product_id;
  if not found then
    raise exception 'Product not found.';
  end if;

  v_next_status := case when v_product.status = 'active' then 'archived' else 'active' end;

  update public.products
  set status = v_next_status
  where id = p_product_id
  returning * into v_product;

  perform public.admin_insert_audit_log(
    v_actor_id,
    case when v_next_status = 'archived' then 'Product Archived' else 'Product Restored' end,
    v_product.name,
    format('Changed status to %s', v_next_status)
  );

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
begin
  if not public.is_admin() then
    raise exception 'Forbidden';
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
    trim(p_payload->>'category'),
    trim(p_payload->>'description'),
    (p_payload->>'amount')::numeric,
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

create or replace function public.save_store_settings(p_payload jsonb)
returns public.store_settings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_settings public.store_settings;
begin
  if not public.is_admin() then
    raise exception 'Forbidden';
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
    trim(p_payload->>'storeName'),
    nullif(trim(p_payload->>'storeLogo'), ''),
    nullif(trim(p_payload->>'address'), ''),
    nullif(trim(p_payload->>'phone'), ''),
    nullif(trim(p_payload->>'email'), ''),
    coalesce(nullif(trim(p_payload->>'currencySymbol'), ''), '₱'),
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
    set current_stock = current_stock - v_quantity
    where id = v_product.id;
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
begin
  if not public.is_admin() then
    raise exception 'Forbidden';
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
    update public.products
    set current_stock = current_stock + v_item.quantity
    where id = v_item.product_id;
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

create or replace function public.receive_stock_delivery(p_payload jsonb)
returns public.stock_receiving_records
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_record public.stock_receiving_records;
  v_item jsonb;
  v_product public.products;
  v_total numeric(12,2) := 0;
  v_quantity integer;
  v_unit_cost numeric(12,2);
begin
  if not public.is_admin() then
    raise exception 'Forbidden';
  end if;

  if jsonb_typeof(p_payload->'items') <> 'array' or jsonb_array_length(p_payload->'items') = 0 then
    raise exception 'Receiving must contain at least one item.';
  end if;

  for v_item in select * from jsonb_array_elements(p_payload->'items')
  loop
    v_quantity := greatest(1, coalesce((v_item->>'quantityReceived')::integer, 0));
    v_unit_cost := greatest(0, coalesce((v_item->>'unitCost')::numeric, 0));
    v_total := v_total + (v_quantity * v_unit_cost);
  end loop;

  insert into public.stock_receiving_records (
    reference_number,
    supplier_id,
    delivery_date,
    total_amount,
    notes,
    recorded_by
  )
  values (
    trim(p_payload->>'referenceNumber'),
    (p_payload->>'supplierId')::uuid,
    coalesce(nullif(p_payload->>'deliveryDate', '')::date, current_date),
    v_total,
    nullif(trim(p_payload->>'notes'), ''),
    v_actor_id
  )
  returning * into v_record;

  for v_item in select * from jsonb_array_elements(p_payload->'items')
  loop
    v_quantity := greatest(1, coalesce((v_item->>'quantityReceived')::integer, 0));
    v_unit_cost := greatest(0, coalesce((v_item->>'unitCost')::numeric, 0));

    select * into v_product
    from public.products
    where id = (v_item->>'productId')::uuid
    for update;

    if not found then
      raise exception 'Product not found.';
    end if;

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
      v_quantity * v_unit_cost
    );

    update public.products
    set
      current_stock = current_stock + v_quantity,
      cost_price = v_unit_cost
    where id = v_product.id;
  end loop;

  perform public.admin_insert_audit_log(
    v_actor_id,
    'Stock Delivery Received',
    v_record.reference_number,
    format('Received supplier delivery valued at %s', v_record.total_amount)
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
  v_allow_negative boolean := false;
  v_product public.products;
  v_quantity integer := greatest(1, coalesce((p_payload->>'quantity')::integer, 0));
  v_adjustment_type text := p_payload->>'adjustmentType';
  v_new_stock integer;
  v_adjustment public.stock_adjustments;
begin
  if not public.is_admin() then
    raise exception 'Forbidden';
  end if;

  select allow_negative_stock into v_allow_negative from public.store_settings where id = 1;

  select * into v_product
  from public.products
  where id = (p_payload->>'productId')::uuid
  for update;

  if not found then
    raise exception 'Product not found.';
  end if;

  v_new_stock := case
    when v_adjustment_type = 'add' then v_product.current_stock + v_quantity
    else v_product.current_stock - v_quantity
  end;

  if not v_allow_negative and v_new_stock < 0 then
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
    p_payload->>'reason',
    v_product.current_stock,
    v_new_stock,
    nullif(trim(p_payload->>'notes'), ''),
    v_actor_id
  )
  returning * into v_adjustment;

  perform public.admin_insert_audit_log(
    v_actor_id,
    'Inventory Adjustment',
    v_product.name,
    format('Adjusted %s %s units', upper(v_adjustment_type), v_quantity)
  );

  return v_adjustment;
end;
$$;

alter table public.profiles enable row level security;
alter table public.store_settings enable row level security;
alter table public.categories enable row level security;
alter table public.suppliers enable row level security;
alter table public.products enable row level security;
alter table public.transactions enable row level security;
alter table public.transaction_items enable row level security;
alter table public.stock_receiving_records enable row level security;
alter table public.stock_receiving_items enable row level security;
alter table public.stock_adjustments enable row level security;
alter table public.expenses enable row level security;
alter table public.audit_logs enable row level security;

create policy "Public can read store settings"
on public.store_settings
for select
to public
using (true);

create policy "Admins can select all profiles"
on public.profiles
for select
to authenticated
using (public.is_admin());

create policy "Users can read own profile"
on public.profiles
for select
to authenticated
using (id = auth.uid());

create policy "Authenticated users can read categories"
on public.categories
for select
to authenticated
using (true);

create policy "Authenticated users can read suppliers"
on public.suppliers
for select
to authenticated
using (true);

create policy "Authenticated users can read active products"
on public.products
for select
to authenticated
using (status = 'active');

create policy "Admins can read all products"
on public.products
for select
to authenticated
using (public.is_admin());

create policy "Admins can insert products"
on public.products
for insert
to authenticated
with check (public.is_admin());

create policy "Admins can update products"
on public.products
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "Authenticated users can read transactions"
on public.transactions
for select
to authenticated
using (true);

create policy "Authenticated users can read transaction items"
on public.transaction_items
for select
to authenticated
using (true);

create policy "Admins can read receiving records"
on public.stock_receiving_records
for select
to authenticated
using (public.is_admin());

create policy "Admins can read receiving items"
on public.stock_receiving_items
for select
to authenticated
using (public.is_admin());

create policy "Admins can read stock adjustments"
on public.stock_adjustments
for select
to authenticated
using (public.is_admin());

create policy "Admins can read expenses"
on public.expenses
for select
to authenticated
using (public.is_admin());

create policy "Admins can read audit logs"
on public.audit_logs
for select
to authenticated
using (public.is_admin());

insert into public.store_settings (
  id,
  store_name,
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
  'Mags Moto',
  '456 Highway Boulevard, Quezon City, Metro Manila',
  '(02) 8888-MOTO / 0917-555-MOTO',
  'sales@magsmoto.ph',
  '₱',
  12,
  false,
  'Thank you for trusting Mags Moto! Ride safe and stay protected.'
)
on conflict (id) do nothing;

insert into public.categories (name, description)
values
  ('Engine Parts & Oils', 'Synthetic oils, spark plugs, filters, pistons'),
  ('Brakes & Suspension', 'Brake pads, fluid, calipers, shocks & forks'),
  ('Tires & Wheels', 'Tubeless tires, inner tubes, alloy mags & rims'),
  ('Chains & Sprockets', 'Drive chains, front/rear sprockets, chain lube'),
  ('Helmets & Gear', 'Full face, modular, gloves, riding jackets'),
  ('Batteries & Electrical', 'Maintenance-free batteries, LED bulbs, horns'),
  ('Accessories & Care', 'Grips, side mirrors, phone mounts, cleaners')
on conflict (name) do nothing;

insert into public.suppliers (name, contact_person, phone, email, address, active)
values
  ('MotoParts Ph Wholesale Distributors', 'Alex Rivera', '(02) 8234-5678', 'sales@motopartsph.com', '45 Logistics Blvd, Valenzuela City', true),
  ('Racing Boy (RCB) Philippines', 'Sarah Jenkins', '0918-876-5432', 'orders@rcbph.com', '88 Supply Way, Pasig Industrial Hub', true),
  ('Motul & Oils Direct Philippines', 'Michael Tan', '0922-345-6789', 'mtan@motuldirect.ph', '12 Warehouse Row, Paranaque City', true),
  ('Dunlop & YTX Tire Supplies', 'Ramon Cruz', '0917-111-2233', 'supplies@dunloptires.ph', '99 Tire Hub, Caloocan City', true)
on conflict (name) do nothing;

insert into storage.buckets (id, name, public)
values ('store-assets', 'store-assets', true)
on conflict (id) do nothing;

create policy "Public can read store assets"
on storage.objects
for select
to public
using (bucket_id = 'store-assets');

create policy "Admins can upload store assets"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'store-assets' and public.is_admin());

create policy "Admins can update store assets"
on storage.objects
for update
to authenticated
using (bucket_id = 'store-assets' and public.is_admin())
with check (bucket_id = 'store-assets' and public.is_admin());

create policy "Admins can delete store assets"
on storage.objects
for delete
to authenticated
using (bucket_id = 'store-assets' and public.is_admin());

revoke all on function public.admin_insert_audit_log(uuid, text, text, text) from public;
grant execute on function public.record_session_event(text) to authenticated;
