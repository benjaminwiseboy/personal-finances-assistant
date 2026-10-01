// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createUser,
  insertAccount,
  insertCategory,
  insertTransaction,
  pg,
  reset,
  sql,
} from "../helpers/test-db";

const session = vi.hoisted(() => ({ userId: "me" as string | null }));
const push = vi.hoisted(() => ({
  delivered: 1,
  sent: [] as { userId: string; title: string; body: string }[],
}));
vi.mock("@/lib/db", async () => (await import("../helpers/test-db")).dbModule);
vi.mock("@/lib/session", () => ({ getUserId: async () => session.userId }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/push", () => ({
  sendToUser: async (userId: string, p: { title: string; body: string }) => {
    push.sent.push({ userId, title: p.title, body: p.body });
    return push.delivered;
  },
}));

import {
  addHoldingMovement,
  compensate,
  createHolding,
  deleteHolding,
  deleteHoldingMovement,
  deleteHoldingTransaction,
  updateHolding,
} from "@/actions/holdings";
import { deleteTransaction } from "@/actions/transactions";
import { queries } from "@/server/queries";
import { runDueReminders } from "@/server/reminders";
import type { HoldingFormInput } from "@/domain/validators";

const ME = "me";
const OTHER = "other";

const base: HoldingFormInput = {
  kind: "loan",
  name: "Prêt à l'ESIF",
  description: "",
  currency: "EUR",
  amount: "1000",
  expected_return_pct: "+10",
  return_period: "total",
  due_date: "2026-10-10",
  due_precision: "day",
  status: "sent",
  account_id: "",
  movement_amount: "",
  movement_date: "",
};

let account: string;

beforeEach(async () => {
  await reset();
  await createUser(ME);
  await createUser(OTHER);
  session.userId = ME;
  push.delivered = 1;
  push.sent = [];
  account = await insertAccount(ME, "Hello Bank"); // initial 1000
});

async function balance(id = account) {
  const [row] = await sql`select balance::text as b from v_account_balances where account_id = ${id}`;
  return row.b;
}

async function count(table: string) {
  const { rows } = await pg.query<{ n: number }>(`select count(*)::int as n from ${table}`);
  return rows[0].n;
}

describe("createHolding", () => {
  it("records a loan funded from an account, outside monthly spending", async () => {
    const result = await createHolding({
      ...base,
      account_id: account,
      movement_amount: "1000",
      movement_date: "2026-07-10",
    });
    expect(result.error).toBeUndefined();

    const [h] = await sql`
      select kind, amount::text as a, expected_return_pct::text as pct, status
      from holdings`;
    expect(h).toEqual({ kind: "loan", a: "1000.00", pct: "10.00", status: "sent" });
    expect(await balance()).toBe("0.00");
    // A loan is not an expense.
    expect(await queries.monthTotals(ME, { year: "2026", month: "7" })).toEqual({
      total_income: 0,
      total_expense: 0,
      net: 0,
    });
  });

  it("credits the account for a debt, in FCFA with spaces", async () => {
    await createHolding({
      ...base,
      kind: "debt",
      name: "Dette papa terrain",
      currency: "XOF",
      amount: "2 000 000",
      expected_return_pct: "",
      due_date: "",
      status: "active",
      account_id: account,
      movement_amount: "3048,98",
      movement_date: "2026-07-01",
    });
    const [h] = await sql`select currency, amount::text as a, expected_return_pct, due_date from holdings`;
    expect(h).toEqual({ currency: "XOF", a: "2000000.00", expected_return_pct: null, due_date: null });
    expect(await balance()).toBe("4048.98");
  });

  it("stores a year-only due date as the end of that year", async () => {
    await createHolding({
      ...base,
      kind: "investment",
      name: "Terrain",
      amount: "2500",
      expected_return_pct: "100",
      due_date: "2030-01-01",
      due_precision: "year",
    });
    const [h] = await sql`select due_date::text as d, due_precision from holdings`;
    expect(h).toEqual({ d: "2030-12-31", due_precision: "year" });
    expect(await count("transactions")).toBe(0);
  });

  it("refuses another user's account and writes nothing", async () => {
    const foreign = await insertAccount(OTHER);
    const result = await createHolding({
      ...base,
      account_id: foreign,
      movement_amount: "1000",
      movement_date: "2026-07-10",
    });
    expect(result.error).toBe("Compte introuvable");
    expect(await count("holdings")).toBe(0);
  });

  it("requires the bank amount when an account is picked", async () => {
    const result = await createHolding({ ...base, account_id: account, movement_date: "2026-07-10" });
    expect(result.error).toMatch(/montant/i);
  });
});

describe("movements", () => {
  let holding: string;
  beforeEach(async () => {
    await createHolding({
      ...base,
      account_id: account,
      movement_amount: "1000",
      movement_date: "2026-07-10",
    });
    holding = (await sql`select id from holdings`)[0].id as string;
  });

  const repay = (over: Partial<Parameters<typeof addHoldingMovement>[0]> = {}) =>
    addHoldingMovement({
      holding_id: holding,
      account_id: account,
      direction: "repayment",
      amount: "400",
      holding_amount: "",
      date: "2026-10-10",
      note: "",
      ...over,
    });

  it("records the opening funding in the ledger", async () => {
    const rows = await queries.holdingMovements(ME, { holding });
    expect(rows).toEqual([
      expect.objectContaining({
        direction: "funding",
        amount: 1000,
        account_name: "Hello Bank",
        bank_amount: -1000,
      }),
    ]);
  });

  it("tracks the reste dû and closes the loan automatically once repaid", async () => {
    await repay();
    let [row] = await queries.holdings(ME);
    expect(row).toMatchObject({ repaid: 400, account_flow: -600, status: "sent", movement_count: 2 });
    expect(await balance()).toBe("400.00");

    // Repaid with the +10 %: closed, the extra 100 is a realised gain.
    await repay({ amount: "700" });
    [row] = await queries.holdings(ME);
    expect(row).toMatchObject({ repaid: 1100, status: "closed" });
  });

  it("reopens when a repayment is deleted", async () => {
    await repay({ amount: "1000" });
    expect((await queries.holdings(ME))[0].status).toBe("closed");

    const [m] = await sql`select id from holding_movements where direction = 'repayment'`;
    expect((await deleteHoldingMovement(m.id as string)).error).toBeUndefined();
    const [row] = await queries.holdings(ME);
    expect(row).toMatchObject({ repaid: 0, status: "active" });
    expect(await balance()).toBe("0.00"); // the bank line went with it
  });

  it("records a repayment hors compte without touching any account", async () => {
    expect((await repay({ account_id: "", amount: "250", note: "Espèces" })).error).toBeUndefined();
    expect(await balance()).toBe("0.00");
    expect((await queries.holdings(ME))[0].repaid).toBe(250);
    const [m] = await queries.holdingMovements(ME, { holding });
    expect(m).toMatchObject({ amount: 250, account_name: null, note: "Espèces" });
  });

  it("refuses a movement on another user's holding", async () => {
    session.userId = OTHER;
    const otherAccount = await insertAccount(OTHER);
    expect((await repay({ account_id: otherAccount })).error).toBe("Placement introuvable");
  });

  it("keeps holding movements out of the regular transaction actions", async () => {
    const [leg] = await sql`select id from transactions`;
    expect((await deleteTransaction(leg.id as string)).error).toMatch(/Placements/);
    expect((await deleteHoldingTransaction(leg.id as string)).error).toBeUndefined();
    expect(await balance()).toBe("1000.00");
    expect(await count("holding_movements")).toBe(0);
  });

  it("deleting the holding removes its movements and restores balances", async () => {
    expect((await deleteHolding(holding)).error).toBeUndefined();
    expect(await count("transactions")).toBe(0);
    expect(await count("holding_movements")).toBe(0);
    expect(await balance()).toBe("1000.00");
  });

  it("does not let a regular transaction carry no origin", async () => {
    const cat = await insertCategory(ME, "Courses");
    await insertTransaction(ME, account, cat, "-5");
    await expect(
      pg.query(
        `update transactions set category_id = null where holding_id is null`,
      ),
    ).rejects.toThrow(/transactions_one_origin/);
  });
});

describe("FCFA holdings", () => {
  it("counts a euro bank repayment in FCFA, at parity or as given", async () => {
    await createHolding({
      ...base,
      kind: "debt",
      name: "Dette papa",
      currency: "XOF",
      amount: "1 000 000",
      status: "active",
    });
    const [{ id }] = await sql`select id from holdings`;
    const pay = (amount: string, holding_amount = "") =>
      addHoldingMovement({
        holding_id: id as string,
        account_id: account,
        direction: "repayment",
        amount,
        holding_amount,
        date: "2026-10-01",
        note: "",
      });

    await pay("762,25");
    expect((await queries.holdings(ME))[0].repaid).toBeCloseTo(500_000, -1);
    expect(await balance()).toBe("237.75"); // repaying a debt is an outflow

    await pay("100", "500 000");
    expect((await queries.holdings(ME))[0].status).toBe("closed"); // within tolerance
  });
});

describe("compensation", () => {
  let loan: string;
  let debt: string;
  beforeEach(async () => {
    await createHolding({ ...base, name: "Prêt à Paul", amount: "1000", status: "active" });
    await createHolding({
      ...base,
      kind: "debt",
      name: "Dette papa",
      currency: "XOF",
      amount: "2 000 000",
      status: "active",
    });
    loan = (await sql`select id from holdings where kind = 'loan'`)[0].id as string;
    debt = (await sql`select id from holdings where kind = 'debt'`)[0].id as string;
  });

  const comp = (from = "1000", to = "655 957") =>
    compensate({
      from_holding_id: loan,
      to_holding_id: debt,
      from_amount: from,
      to_amount: to,
      date: "2026-10-05",
      note: "",
    });

  it("lowers both restes dus without any bank movement", async () => {
    expect((await comp()).error).toBeUndefined();
    const rows = Object.fromEntries((await queries.holdings(ME)).map((h) => [h.kind, h]));
    expect(rows.loan).toMatchObject({ repaid: 1000, status: "closed" });
    expect(rows.debt).toMatchObject({ repaid: 655_957, status: "active" });
    expect(await count("transactions")).toBe(0);
    expect(await balance()).toBe("1000.00");

    const [m] = await queries.holdingMovements(ME, { holding: debt });
    expect(m).toMatchObject({ counterpart_name: "Prêt à Paul", account_name: null });
  });

  it("cancels both halves together", async () => {
    await comp();
    const [m] = await sql`select id from holding_movements where holding_id = ${debt}`;
    await deleteHoldingMovement(m.id as string);
    expect(await count("holding_movements")).toBe(0);
    expect((await queries.holdings(ME)).every((h) => h.status === "active")).toBe(true);
  });

  it("deleting one side reopens the other", async () => {
    await comp("1000", "2 000 000");
    expect((await queries.holdings(ME)).every((h) => h.status === "closed")).toBe(true);
    await deleteHolding(loan);
    const [row] = await queries.holdings(ME);
    expect(row).toMatchObject({ kind: "debt", repaid: 0, status: "active" });
  });

  it("only goes from a loan or investment to a debt", async () => {
    const result = await compensate({
      from_holding_id: debt,
      to_holding_id: loan,
      from_amount: "1",
      to_amount: "1",
      date: "2026-10-05",
      note: "",
    });
    expect(result.error).toBeDefined();
    expect(await count("holding_movements")).toBe(0);
  });
});

describe("updateHolding", () => {
  it("edits fields but never touches the bank movements", async () => {
    await createHolding({ ...base, account_id: account, movement_amount: "1000", movement_date: "2026-07-10" });
    const [{ id }] = await sql`select id from holdings`;
    const result = await updateHolding(id as string, {
      ...base,
      status: "closed",
      due_date: "2027-10-05",
      due_precision: "month",
      account_id: account,
      movement_amount: "999",
      movement_date: "2026-07-10",
    });
    expect(result.error).toBeUndefined();
    const [h] = await sql`select status, due_date::text as d from holdings`;
    expect(h).toEqual({ status: "closed", d: "2027-10-31" });
    expect(await count("transactions")).toBe(1);
  });
});

describe("upcoming due dates", () => {
  it("lists open holdings due within 60 days or overdue", async () => {
    const soon = new Date(Date.now() + 5 * 86_400_000).toISOString().slice(0, 10);
    const far = new Date(Date.now() + 200 * 86_400_000).toISOString().slice(0, 10);
    await createHolding({ ...base, name: "Bientôt", due_date: soon });
    await createHolding({ ...base, name: "En retard", due_date: "2020-01-01" });
    await createHolding({ ...base, name: "Loin", due_date: far });
    await createHolding({ ...base, name: "Soldé", due_date: soon, status: "closed" });
    await createHolding({ ...base, name: "Sans date", due_date: "" });

    const rows = await queries.upcomingDue(ME);
    expect(rows.map((r) => r.name)).toEqual(["En retard", "Bientôt"]);
  });
});

describe("runDueReminders", () => {
  beforeEach(async () => {
    await createHolding({ ...base, due_date: "2026-10-10" });
    await createHolding({ ...base, name: "Terminé", due_date: "2026-10-10", status: "closed" });
    await createHolding({ ...base, name: "Loin", due_date: "2027-10-10" });
  });

  it("sends the reached milestone once per due date", async () => {
    expect(await runDueReminders("2026-10-03")).toEqual({ checked: 1, sent: 1 });
    expect(push.sent).toEqual([
      { userId: ME, title: "Prêt à l'ESIF", body: "Retour de ton prêt dans 7 jours." },
    ]);

    // Same day again: nothing new.
    expect((await runDueReminders("2026-10-03")).sent).toBe(0);
    // The eve: the 1-day reminder.
    await runDueReminders("2026-10-09");
    expect(push.sent.at(-1)?.body).toBe("Retour de ton prêt demain.");

    // Moving the due date re-arms the reminders.
    await sql`update holdings set due_date = '2026-10-20' where name = 'Prêt à l''ESIF'`;
    expect((await runDueReminders("2026-10-13")).sent).toBe(1);
  });

  it("does not mark a reminder sent when no device received it", async () => {
    push.delivered = 0;
    await runDueReminders("2026-10-03");
    expect(await count("holding_reminders")).toBe(0);
    push.delivered = 1;
    expect((await runDueReminders("2026-10-04")).sent).toBe(1);
  });
});
