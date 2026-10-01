-- Holding movements ------------------------------------------------------------
-- The ledger of a placement / loan / debt, in the holding's own currency:
--   funding   = money engaged (you invest or lend; for a debt, you borrow)
--   repayment = money coming back to close it (returns or repayment received;
--               for a debt, what you pay back) — this is what the "reste dû"
--               is computed from.
-- A movement may have a bank side (transaction_id → a transaction carrying
-- holding_id, amount in euros on the account), or none: cash, payment in kind,
-- or a compensation where your debtor pays your creditor directly. The two
-- halves of a compensation share a compensation_id.

create table holding_movements (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references "user"(id) on delete cascade,
  holding_id uuid not null references holdings(id) on delete cascade,
  direction text not null check (direction in ('funding', 'repayment')),
  amount numeric(16,2) not null check (amount > 0),
  date date not null,
  note text,
  -- Deleting the bank transaction (e.g. from the Transactions page) removes
  -- the movement with it.
  transaction_id uuid unique references transactions(id) on delete cascade,
  compensation_id uuid,
  created_at timestamptz not null default now()
);

create index holding_movements_holding_id_idx on holding_movements(holding_id);
create index holding_movements_compensation_id_idx on holding_movements(compensation_id);

-- Backfill: every bank movement recorded so far becomes a ledger entry.
-- Money leaving the account funds an investment/loan and repays a debt.
insert into holding_movements (user_id, holding_id, direction, amount, date, note, transaction_id)
select
  t.user_id,
  t.holding_id,
  case
    when (h.kind = 'debt') = (t.amount > 0) then 'funding'
    else 'repayment'
  end,
  round(abs(t.amount) * case h.currency when 'XOF' then 655.957 else 1 end, 2),
  t.date,
  t.description,
  t.id
from transactions t
join holdings h on h.id = t.holding_id;
