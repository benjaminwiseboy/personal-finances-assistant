import "server-only";
import { sql } from "@/lib/db";
import type {
  Currency,
  DuePrecision,
  HoldingKind,
  HoldingStatus,
  MovementDirection,
  ReturnPeriod,
} from "@/domain/holdings";

// Every read the client pages need, scoped to the signed-in user. Served by
// /api/data/[query] and called from the browser through `fetchData()`.
//
// Casts: Postgres numeric comes back from the driver as a string and date as a
// JS Date, so amounts are cast to float8 and dates to text to keep the shapes
// the UI was built on (plain numbers, "YYYY-MM-DD" strings).

type Params = Record<string, string>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const int = (v: string | undefined) => Number.parseInt(v ?? "", 10);

function monthRange(p: Params) {
  const year = int(p.year);
  const month = int(p.month);
  if (!year || !month || month < 1 || month > 12) {
    throw new BadRequest("year/month invalides");
  }
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    year,
    month,
    start: `${year}-${pad(month)}-01`,
    end: month === 12 ? `${year + 1}-01-01` : `${year}-${pad(month + 1)}-01`,
  };
}

export class BadRequest extends Error {}

export type HoldingRow = {
  id: string;
  kind: HoldingKind;
  name: string;
  description: string | null;
  currency: Currency;
  amount: number;
  expected_return_pct: number | null;
  return_period: ReturnPeriod;
  due_date: string | null;
  due_precision: DuePrecision;
  status: HoldingStatus;
  account_flow: number;
  movement_count: number;
  /** Repayments so far, in the holding's currency (bank or not). */
  repaid: number;
};

export const queries = {
  accountBalances: async (userId: string) =>
    (await sql`
      select account_id, name, type,
             initial_balance::float8 as initial_balance,
             balance::float8 as balance, is_primary
      from v_account_balances
      where user_id = ${userId}
      order by name`) as {
      account_id: string;
      name: string;
      type: string;
      initial_balance: number;
      balance: number;
      is_primary: boolean;
    }[],

  accountOptions: async (userId: string) =>
    (await sql`
      select id, name from accounts
      where user_id = ${userId}
      order by name`) as { id: string; name: string }[],

  categories: async (userId: string) =>
    (await sql`
      select id, name, type, parent_id from categories
      where user_id = ${userId}
      order by name`) as {
      id: string;
      name: string;
      type: "income" | "expense";
      parent_id: string | null;
    }[],

  rootExpenseCategories: async (userId: string) =>
    (await sql`
      select id, name from categories
      where user_id = ${userId} and type = 'expense' and parent_id is null
      order by name`) as { id: string; name: string }[],

  monthlyNets: async (userId: string) =>
    (await sql`
      select year, month, net::float8 as net
      from v_monthly_totals
      where user_id = ${userId}`) as {
      year: number;
      month: number;
      net: number;
    }[],

  monthTotals: async (userId: string, p: Params) => {
    const { year, month } = monthRange(p);
    const rows = await sql`
      select total_income::float8 as total_income,
             total_expense::float8 as total_expense,
             net::float8 as net
      from v_monthly_totals
      where user_id = ${userId} and year = ${year} and month = ${month}`;
    return (rows[0] ?? { total_income: 0, total_expense: 0, net: 0 }) as {
      total_income: number;
      total_expense: number;
      net: number;
    };
  },

  /** Expense totals per root category for one month, largest first. */
  monthExpensesByCategory: async (userId: string, p: Params) => {
    const { year, month } = monthRange(p);
    return (await sql`
      select category_root_id, category_name, total::float8 as total
      from v_category_monthly_summary
      where user_id = ${userId} and type = 'expense'
        and year = ${year} and month = ${month}
      order by total desc`) as {
      category_root_id: string;
      category_name: string;
      total: number;
    }[];
  },

  /** Expense totals per root category, every month. */
  expenseHistory: async (userId: string) =>
    (await sql`
      select category_root_id, category_name, year, month,
             total::float8 as total
      from v_category_monthly_summary
      where user_id = ${userId} and type = 'expense'`) as {
      category_root_id: string;
      category_name: string;
      year: number;
      month: number;
      total: number;
    }[],

  budgets: async (userId: string) =>
    (await sql`
      select b.id, b.category_id, b.amount::float8 as amount,
             coalesce(c.name, '') as category_name
      from budgets b
      left join categories c on c.id = b.category_id
      where b.user_id = ${userId}`) as {
      id: string;
      category_id: string;
      amount: number;
      category_name: string;
    }[],

  recentTransactions: async (userId: string, p: Params) => {
    const { start, end } = monthRange(p);
    return (await sql`
      select id, date::text as date, description, amount::float8 as amount
      from transactions
      where user_id = ${userId} and date >= ${start} and date < ${end}
      order by date desc, created_at desc
      limit 10`) as {
      id: string;
      date: string;
      description: string;
      amount: number;
    }[];
  },

  transactions: async (userId: string, p: Params) => {
    const { start, end } = monthRange(p);
    const account = p.account && p.account !== "all" ? p.account : null;
    if (account && !UUID.test(account)) throw new BadRequest("compte invalide");
    return (await sql`
      select t.id, t.account_id, coalesce(a.name, '') as account_name,
             t.category_id, c.name as category_name, t.transfer_id,
             t.holding_id, h.name as holding_name,
             t.amount::float8 as amount, t.date::text as date, t.description
      from transactions t
      left join accounts a on a.id = t.account_id
      left join categories c on c.id = t.category_id
      left join holdings h on h.id = t.holding_id
      where t.user_id = ${userId}
        and t.date >= ${start} and t.date < ${end}
        and (${account}::uuid is null or t.account_id = ${account}::uuid)
      order by t.date desc, t.created_at desc`) as {
      id: string;
      account_id: string;
      account_name: string;
      category_id: string | null;
      category_name: string | null;
      transfer_id: string | null;
      holding_id: string | null;
      holding_name: string | null;
      amount: number;
      date: string;
      description: string;
    }[];
  },

  /**
   * Every holding, with the net euros that moved on bank accounts for it
   * (negative = money that left the accounts).
   */
  holdings: async (userId: string) =>
    (await sql`
      select h.id, h.kind, h.name, h.description, h.currency,
             h.amount::float8 as amount,
             h.expected_return_pct::float8 as expected_return_pct,
             h.return_period, h.due_date::text as due_date, h.due_precision,
             h.status,
             coalesce((select sum(t.amount) from transactions t
                       where t.holding_id = h.id), 0)::float8 as account_flow,
             coalesce((select count(*) from holding_movements m
                       where m.holding_id = h.id), 0)::int as movement_count,
             coalesce((select sum(m.amount) from holding_movements m
                       where m.holding_id = h.id and m.direction = 'repayment'), 0)::float8
               as repaid
      from holdings h
      where h.user_id = ${userId}
      order by h.due_date asc nulls last, h.created_at desc`) as HoldingRow[],

  /**
   * A holding's ledger, newest first: amount in the holding's currency, plus
   * the bank side (account, euros) or the compensation counterpart.
   */
  holdingMovements: async (userId: string, p: Params) => {
    if (!UUID.test(p.holding ?? "")) throw new BadRequest("placement invalide");
    return (await sql`
      select m.id, m.direction, m.amount::float8 as amount, m.date::text as date,
             m.note, a.name as account_name, t.amount::float8 as bank_amount,
             other_h.name as counterpart_name
      from holding_movements m
      left join transactions t on t.id = m.transaction_id
      left join accounts a on a.id = t.account_id
      left join holding_movements other
        on other.compensation_id = m.compensation_id and other.id <> m.id
      left join holdings other_h on other_h.id = other.holding_id
      where m.user_id = ${userId} and m.holding_id = ${p.holding}
      order by m.date desc, m.created_at desc`) as {
      id: string;
      direction: MovementDirection;
      amount: number;
      date: string;
      note: string | null;
      account_name: string | null;
      bank_amount: number | null;
      counterpart_name: string | null;
    }[];
  },

  /** Open holdings due within 60 days, or already overdue. */
  upcomingDue: async (userId: string) =>
    (await sql`
      select id, kind, name, currency, amount::float8 as amount,
             due_date::text as due_date, due_precision, status,
             coalesce((select sum(m.amount) from holding_movements m
                       where m.holding_id = holdings.id and m.direction = 'repayment'), 0)::float8
               as repaid
      from holdings
      where user_id = ${userId}
        and status not in ('closed', 'defaulted')
        and due_date is not null
        and due_date <= current_date + 60
      order by due_date`) as Pick<
      HoldingRow,
      "id" | "kind" | "name" | "currency" | "amount" | "due_date" | "due_precision" | "status" | "repaid"
    >[],
} satisfies Record<string, (userId: string, p: Params) => Promise<unknown>>;

export type Queries = typeof queries;
export type QueryName = keyof Queries;
export type QueryResult<K extends QueryName> = Awaited<ReturnType<Queries[K]>>;
