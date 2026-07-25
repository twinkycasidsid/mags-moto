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
    v_sku := 'SKU-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 12));
    exit when not exists (select 1 from public.products where sku = v_sku);
  end loop;

  return v_sku;
end;
$$;
