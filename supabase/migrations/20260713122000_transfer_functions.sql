create or replace function create_transfer(
  p_from_account_id uuid,
  p_to_account_id uuid,
  p_amount numeric,
  p_date date,
  p_description text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_transfer_id uuid;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_from_account_id = p_to_account_id then
    raise exception 'Les comptes source et destination doivent être différents';
  end if;

  if p_amount <= 0 then
    raise exception 'Le montant doit être positif';
  end if;

  if not exists (
    select 1 from accounts where id = p_from_account_id and user_id = v_user_id
  ) then
    raise exception 'Compte source introuvable';
  end if;

  if not exists (
    select 1 from accounts where id = p_to_account_id and user_id = v_user_id
  ) then
    raise exception 'Compte destination introuvable';
  end if;

  insert into transfers (user_id, from_account_id, to_account_id, amount, date, description)
  values (v_user_id, p_from_account_id, p_to_account_id, p_amount, p_date, p_description)
  returning id into v_transfer_id;

  insert into transactions (user_id, account_id, category_id, transfer_id, amount, date, description)
  values
    (v_user_id, p_from_account_id, null, v_transfer_id, -p_amount, p_date, coalesce(p_description, 'Transfert')),
    (v_user_id, p_to_account_id, null, v_transfer_id, p_amount, p_date, coalesce(p_description, 'Transfert'));

  return v_transfer_id;
end;
$$;

create or replace function delete_transfer(p_transfer_id uuid) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (
    select 1 from transfers where id = p_transfer_id and user_id = v_user_id
  ) then
    raise exception 'Transfert introuvable';
  end if;

  delete from transactions where transfer_id = p_transfer_id;
  delete from transfers where id = p_transfer_id;
end;
$$;

grant execute on function create_transfer(uuid, uuid, numeric, date, text) to authenticated;
grant execute on function delete_transfer(uuid) to authenticated;
