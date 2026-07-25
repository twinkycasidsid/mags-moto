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
  v_category text := trim(coalesce(p_payload->>'category', ''));
  v_type_of_expense text := trim(coalesce(p_payload->>'description', ''));
  v_amount numeric(12,2) := coalesce((p_payload->>'amount')::numeric, 0);
begin
  if not public.is_admin() then
    raise exception 'Forbidden';
  end if;

  if v_category = '' then
    raise exception 'Expense category is required.';
  end if;

  if v_type_of_expense = '' then
    raise exception 'Type of expense is required.';
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

create or replace function public.delete_expense(p_expense_id uuid)
returns void
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

  select * into v_expense
  from public.expenses
  where id = p_expense_id;

  if not found then
    raise exception 'Expense not found.';
  end if;

  delete from public.expenses
  where id = p_expense_id;

  perform public.admin_insert_audit_log(
    v_actor_id,
    'Expense Deleted',
    v_expense.category,
    format('Deleted expense %s amounting to %s', v_expense.description, v_expense.amount)
  );
end;
$$;

grant execute on function public.update_expense(uuid, jsonb) to authenticated;
grant execute on function public.delete_expense(uuid) to authenticated;
