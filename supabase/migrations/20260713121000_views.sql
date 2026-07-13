-- Account balance = initial balance + sum of all its transactions
-- (transfer-linked transactions ARE included: they move real money between
-- accounts and must affect the balance).
create view v_account_balances
  with (security_invoker = true) as
select
  a.id as account_id,
  a.user_id,
  a.name,
  a.type,
  a.initial_balance,
  a.initial_balance + coalesce(sum(t.amount), 0) as balance
from accounts a
left join transactions t on t.account_id = a.id
group by a.id, a.user_id, a.name, a.type, a.initial_balance;

-- Monthly spending/income per root category, excluding transfer-linked
-- transactions (a transfer is not a real expense/income).
create view v_category_monthly_summary
  with (security_invoker = true) as
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

-- Monthly totals (income / expense / net), excluding transfer-linked
-- transactions.
create view v_monthly_totals
  with (security_invoker = true) as
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
