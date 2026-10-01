-- Neon schema (replaces supabase/migrations/*). Auth is handled by Better Auth,
-- whose tables live in this same database. There is no RLS: every query runs
-- server-side and filters on the session's user id explicitly.

-- Better Auth core tables (better-auth 1.7, camelCase columns) ---------------

create table "user" (
  "id" text primary key,
  "name" text not null,
  "email" text not null unique,
  "emailVerified" boolean not null default false,
  "image" text,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create table "session" (
  "id" text primary key,
  "expiresAt" timestamptz not null,
  "token" text not null unique,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now(),
  "ipAddress" text,
  "userAgent" text,
  "userId" text not null references "user"("id") on delete cascade
);
create index session_user_id_idx on "session"("userId");

create table "account" (
  "id" text primary key,
  "accountId" text not null,
  "providerId" text not null,
  "userId" text not null references "user"("id") on delete cascade,
  "accessToken" text,
  "refreshToken" text,
  "idToken" text,
  "accessTokenExpiresAt" timestamptz,
  "refreshTokenExpiresAt" timestamptz,
  "scope" text,
  "password" text,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);
create index account_user_id_idx on "account"("userId");

create table "verification" (
  "id" text primary key,
  "identifier" text not null,
  "value" text not null,
  "expiresAt" timestamptz not null,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);
create index verification_identifier_idx on "verification"("identifier");

-- Accounts -------------------------------------------------------------------

create table accounts (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references "user"(id) on delete cascade,
  name text not null,
  type text not null,
  initial_balance numeric(12,2) not null default 0,
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);

create index accounts_user_id_idx on accounts(user_id);

-- The account where the salary lands; at most one per user.
create unique index accounts_one_primary_per_user
  on accounts (user_id)
  where is_primary;

-- Categories -----------------------------------------------------------------

create table categories (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references "user"(id) on delete cascade,
  name text not null,
  type text not null check (type in ('income', 'expense')),
  parent_id uuid references categories(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index categories_user_id_idx on categories(user_id);
create index categories_parent_id_idx on categories(parent_id);

-- Transfers ------------------------------------------------------------------
-- Only ever written through create_transfer / delete_transfer below, which keep
-- the transfer row and its two linked transactions consistent.

create table transfers (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references "user"(id) on delete cascade,
  from_account_id uuid not null references accounts(id) on delete restrict,
  to_account_id uuid not null references accounts(id) on delete restrict,
  amount numeric(12,2) not null check (amount > 0),
  date date not null,
  description text,
  created_at timestamptz not null default now(),
  constraint transfers_distinct_accounts check (from_account_id <> to_account_id)
);

-- Transactions ---------------------------------------------------------------

create table transactions (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references "user"(id) on delete cascade,
  account_id uuid not null references accounts(id) on delete restrict,
  category_id uuid references categories(id) on delete restrict,
  transfer_id uuid references transfers(id) on delete cascade,
  amount numeric(12,2) not null,
  date date not null,
  description text not null,
  created_at timestamptz not null default now(),
  constraint transactions_category_xor_transfer check (
    (transfer_id is null and category_id is not null)
    or (transfer_id is not null and category_id is null)
  )
);

create index transactions_user_date_idx on transactions(user_id, date);
create index transactions_account_id_idx on transactions(account_id);
create index transactions_category_id_idx on transactions(category_id);
create index transactions_transfer_id_idx on transactions(transfer_id);

-- Budgets --------------------------------------------------------------------
-- A recurring monthly spending limit for one root expense category.

create table budgets (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references "user"(id) on delete cascade,
  category_id uuid not null references categories(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint budgets_unique_category unique (user_id, category_id)
);

create index budgets_category_id_idx on budgets(category_id);

-- Views ----------------------------------------------------------------------

-- Account balance = initial balance + sum of all its transactions (transfer
-- legs included: they move real money between accounts).
create view v_account_balances as
select
  a.id as account_id,
  a.user_id,
  a.name,
  a.type,
  a.initial_balance,
  a.initial_balance + coalesce(sum(t.amount), 0) as balance,
  a.is_primary
from accounts a
left join transactions t on t.account_id = a.id
group by a.id, a.user_id, a.name, a.type, a.initial_balance, a.is_primary;

-- Monthly spending/income per root category, transfers excluded.
create view v_category_monthly_summary as
select
  t.user_id,
  coalesce(c.parent_id, c.id) as category_root_id,
  coalesce(root.name, c.name) as category_name,
  c.type,
  extract(year from t.date)::int as year,
  extract(month from t.date)::int as month,
  sum(abs(t.amount)) as total
from transactions t
join categories c on c.id = t.category_id
left join categories root on root.id = c.parent_id
where t.transfer_id is null
group by
  t.user_id,
  coalesce(c.parent_id, c.id),
  coalesce(root.name, c.name),
  c.type,
  extract(year from t.date),
  extract(month from t.date);

-- Monthly totals (income / expense / net), transfers excluded.
create view v_monthly_totals as
select
  t.user_id,
  extract(year from t.date)::int as year,
  extract(month from t.date)::int as month,
  coalesce(sum(t.amount) filter (where t.amount > 0), 0) as total_income,
  coalesce(abs(sum(t.amount) filter (where t.amount < 0)), 0) as total_expense,
  coalesce(sum(t.amount), 0) as net
from transactions t
where t.transfer_id is null
group by t.user_id, extract(year from t.date), extract(month from t.date);

-- Transfer functions ---------------------------------------------------------
-- The caller (a server action) passes the authenticated user id; ownership of
-- both accounts is checked here so a transfer can't touch someone else's data.

create function create_transfer(
  p_user_id text,
  p_from_account_id uuid,
  p_to_account_id uuid,
  p_amount numeric,
  p_date date,
  p_description text
) returns uuid
language plpgsql
as $$
declare
  v_transfer_id uuid;
begin
  if p_from_account_id = p_to_account_id then
    raise exception 'Les comptes source et destination doivent être différents';
  end if;

  if p_amount <= 0 then
    raise exception 'Le montant doit être positif';
  end if;

  if not exists (
    select 1 from accounts where id = p_from_account_id and user_id = p_user_id
  ) then
    raise exception 'Compte source introuvable';
  end if;

  if not exists (
    select 1 from accounts where id = p_to_account_id and user_id = p_user_id
  ) then
    raise exception 'Compte destination introuvable';
  end if;

  insert into transfers (user_id, from_account_id, to_account_id, amount, date, description)
  values (p_user_id, p_from_account_id, p_to_account_id, p_amount, p_date, p_description)
  returning id into v_transfer_id;

  insert into transactions (user_id, account_id, category_id, transfer_id, amount, date, description)
  values
    (p_user_id, p_from_account_id, null, v_transfer_id, -p_amount, p_date, coalesce(p_description, 'Transfert')),
    (p_user_id, p_to_account_id, null, v_transfer_id, p_amount, p_date, coalesce(p_description, 'Transfert'));

  return v_transfer_id;
end;
$$;

create function delete_transfer(p_user_id text, p_transfer_id uuid) returns void
language plpgsql
as $$
begin
  if not exists (
    select 1 from transfers where id = p_transfer_id and user_id = p_user_id
  ) then
    raise exception 'Transfert introuvable';
  end if;

  delete from transactions where transfer_id = p_transfer_id;
  delete from transfers where id = p_transfer_id;
end;
$$;
