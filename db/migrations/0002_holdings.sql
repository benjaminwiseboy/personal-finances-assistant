-- Placements, prêts accordés et dettes ---------------------------------------
-- A "holding" is money engaged outside the bank accounts: an investment, a
-- loan you granted (both owed back to you) or a debt you owe. Its amount is in
-- its own currency (EUR or XOF/FCFA). Money that actually moved on a bank
-- account is recorded as transactions linked through transactions.holding_id.

create table holdings (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references "user"(id) on delete cascade,
  kind text not null check (kind in ('investment', 'loan', 'debt')),
  name text not null,
  description text,
  currency text not null default 'EUR' check (currency in ('EUR', 'XOF')),
  amount numeric(16,2) not null check (amount > 0),
  -- Expected return in %, over the whole life ('total') or per year ('annual').
  expected_return_pct numeric(7,2),
  return_period text not null default 'total'
    check (return_period in ('total', 'annual')),
  -- Optional due date. A due date known only to the month or year is stored
  -- as the last day of that period, and displayed at that precision.
  due_date date,
  due_precision text not null default 'day'
    check (due_precision in ('day', 'month', 'year')),
  status text not null default 'active'
    check (status in ('planned', 'sent', 'active', 'closed', 'defaulted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index holdings_user_id_idx on holdings(user_id);

-- Movements = transactions carrying a holding_id (no category, no transfer).
alter table transactions
  add column holding_id uuid references holdings(id) on delete cascade;

create index transactions_holding_id_idx on transactions(holding_id);

alter table transactions drop constraint transactions_category_xor_transfer;
alter table transactions add constraint transactions_one_origin check (
  num_nonnulls(category_id, transfer_id, holding_id) = 1
);

-- Like transfers, holding movements are not income or spending.
create or replace view v_monthly_totals as
select
  t.user_id,
  extract(year from t.date)::int as year,
  extract(month from t.date)::int as month,
  coalesce(sum(t.amount) filter (where t.amount > 0), 0) as total_income,
  coalesce(abs(sum(t.amount) filter (where t.amount < 0)), 0) as total_expense,
  coalesce(sum(t.amount), 0) as net
from transactions t
where t.transfer_id is null and t.holding_id is null
group by t.user_id, extract(year from t.date), extract(month from t.date);

-- Push notifications ---------------------------------------------------------

-- One row per device that accepted notifications.
create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references "user"(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);

create index push_subscriptions_user_id_idx on push_subscriptions(user_id);

-- Due-date reminders already sent, so the daily job never repeats one.
-- Keyed on the due date too: moving the due date re-arms the reminders.
create table holding_reminders (
  holding_id uuid not null references holdings(id) on delete cascade,
  due_date date not null,
  milestone int not null, -- days before due: 30, 7, 1, 0, or -1 = overdue
  sent_at timestamptz not null default now(),
  primary key (holding_id, due_date, milestone)
);
