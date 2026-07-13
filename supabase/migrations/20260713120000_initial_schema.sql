-- Accounts ---------------------------------------------------------------

create table accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  type text not null,
  initial_balance numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);

alter table accounts enable row level security;

create policy "accounts_select_own" on accounts
  for select using (auth.uid() = user_id);
create policy "accounts_insert_own" on accounts
  for insert with check (auth.uid() = user_id);
create policy "accounts_update_own" on accounts
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "accounts_delete_own" on accounts
  for delete using (auth.uid() = user_id);

-- Categories ---------------------------------------------------------------

create table categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  type text not null check (type in ('income', 'expense')),
  parent_id uuid references categories(id) on delete restrict,
  created_at timestamptz not null default now()
);

alter table categories enable row level security;

create policy "categories_select_own" on categories
  for select using (auth.uid() = user_id);
create policy "categories_insert_own" on categories
  for insert with check (auth.uid() = user_id);
create policy "categories_update_own" on categories
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "categories_delete_own" on categories
  for delete using (auth.uid() = user_id);

create index categories_parent_id_idx on categories(parent_id);

-- Transfers ------------------------------------------------------------------
-- Rows are only ever inserted/deleted via the create_transfer / delete_transfer
-- SECURITY DEFINER functions (see migration 20260713122000), never directly by
-- the client, so only a select policy is granted here.

create table transfers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  from_account_id uuid not null references accounts(id) on delete restrict,
  to_account_id uuid not null references accounts(id) on delete restrict,
  amount numeric(12,2) not null check (amount > 0),
  date date not null,
  description text,
  created_at timestamptz not null default now(),
  constraint transfers_distinct_accounts check (from_account_id <> to_account_id)
);

alter table transfers enable row level security;

create policy "transfers_select_own" on transfers
  for select using (auth.uid() = user_id);

-- Transactions ---------------------------------------------------------------
-- Direct client insert/update/delete is only allowed for regular (non-transfer)
-- transactions. Transfer-linked rows (transfer_id not null) can only be
-- written by the SECURITY DEFINER functions, which bypass RLS as the function
-- owner — this policy still blocks any accidental/malicious direct write to
-- those rows from the client.

create table transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
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

alter table transactions enable row level security;

create policy "transactions_select_own" on transactions
  for select using (auth.uid() = user_id);
create policy "transactions_insert_own" on transactions
  for insert with check (auth.uid() = user_id and transfer_id is null);
create policy "transactions_update_own" on transactions
  for update using (auth.uid() = user_id and transfer_id is null)
  with check (auth.uid() = user_id and transfer_id is null);
create policy "transactions_delete_own" on transactions
  for delete using (auth.uid() = user_id and transfer_id is null);

create index transactions_account_id_idx on transactions(account_id);
create index transactions_category_id_idx on transactions(category_id);
create index transactions_transfer_id_idx on transactions(transfer_id);
create index transactions_date_idx on transactions(date);
