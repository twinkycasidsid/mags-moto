alter table public.categories
  add column if not exists active boolean not null default true;

update public.categories
set active = true
where active is null;

create or replace function public.normalize_category_name(p_name text)
returns text
language sql
immutable
as $$
  select lower(regexp_replace(trim(coalesce(p_name, '')), '\s+', ' ', 'g'));
$$;

drop index if exists categories_normalized_name_idx;
create unique index if not exists categories_normalized_name_idx
on public.categories (public.normalize_category_name(name));

create or replace function public.create_product_category(p_payload jsonb)
returns public.categories
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_name text := regexp_replace(trim(coalesce(p_payload->>'name', '')), '\s+', ' ', 'g');
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
    where public.normalize_category_name(name) = public.normalize_category_name(v_name)
  ) then
    raise exception 'Category already exists.';
  end if;

  insert into public.categories (name, description, active)
  values (
    v_name,
    nullif(trim(coalesce(p_payload->>'description', '')), ''),
    true
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

create or replace function public.update_product_category(
  p_category_id uuid,
  p_payload jsonb
)
returns public.categories
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_name text := regexp_replace(trim(coalesce(p_payload->>'name', '')), '\s+', ' ', 'g');
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
    where public.normalize_category_name(name) = public.normalize_category_name(v_name)
      and id <> p_category_id
  ) then
    raise exception 'Category already exists.';
  end if;

  update public.categories
  set
    name = v_name,
    description = nullif(trim(coalesce(p_payload->>'description', '')), '')
  where id = p_category_id
  returning * into v_category;

  if not found then
    raise exception 'Category not found.';
  end if;

  perform public.admin_insert_audit_log(
    v_actor_id,
    'Category Updated',
    v_category.name,
    'Updated category details'
  );

  return v_category;
end;
$$;

create or replace function public.set_category_active(
  p_category_id uuid,
  p_active boolean
)
returns public.categories
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_category public.categories;
begin
  if not public.is_admin() then
    raise exception 'Forbidden';
  end if;

  update public.categories
  set active = p_active
  where id = p_category_id
  returning * into v_category;

  if not found then
    raise exception 'Category not found.';
  end if;

  perform public.admin_insert_audit_log(
    v_actor_id,
    case when p_active then 'Category Reactivated' else 'Category Deactivated' end,
    v_category.name,
    case when p_active then 'Reactivated category' else 'Deactivated category' end
  );

  return v_category;
end;
$$;

create or replace function public.delete_product_category(p_category_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_category public.categories;
  v_product_count integer;
begin
  if not public.is_admin() then
    raise exception 'Forbidden';
  end if;

  select * into v_category
  from public.categories
  where id = p_category_id;

  if not found then
    raise exception 'Category not found.';
  end if;

  select count(*)::integer into v_product_count
  from public.products
  where category_id = p_category_id;

  if v_product_count > 0 then
    raise exception 'Category cannot be deleted because products are assigned to it. Reassign those products or deactivate the category instead.';
  end if;

  delete from public.categories
  where id = p_category_id;

  perform public.admin_insert_audit_log(
    v_actor_id,
    'Category Deleted',
    v_category.name,
    'Deleted unused category'
  );

  return p_category_id;
end;
$$;

drop policy if exists "Authenticated users can read categories" on public.categories;
create policy "Admins can read all categories"
on public.categories
for select
to authenticated
using (public.is_admin());

create policy "Authenticated users can read active categories"
on public.categories
for select
to authenticated
using (active = true);
