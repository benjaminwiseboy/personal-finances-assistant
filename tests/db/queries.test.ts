// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createUser,
  insertAccount,
  insertCategory,
  insertTransaction,
  reset,
  sql,
} from "../helpers/test-db";

vi.mock("@/lib/db", async () => (await import("../helpers/test-db")).dbModule);

import { BadRequest, queries } from "@/server/queries";

const ME = "me";
const OTHER = "other";
const JULY = { year: "2026", month: "7" };

let courant: string;
let livret: string;
let courses: string;
let resto: string;

beforeEach(async () => {
  await reset();
  await createUser(ME);
  await createUser(OTHER);

  courant = await insertAccount(ME, "Courant"); // initial 1000
  livret = await insertAccount(ME, "Livret"); // initial 1000
  const alim = await insertCategory(ME, "Alimentation");
  courses = await insertCategory(ME, "Courses", "expense", alim);
  resto = await insertCategory(ME, "Restaurant", "expense", alim);
  const salaire = await insertCategory(ME, "Salaire", "income");

  await insertTransaction(ME, courant, salaire, "2000", "2026-07-01");
  await insertTransaction(ME, courant, courses, "-120.50", "2026-07-10");
  await insertTransaction(ME, courant, resto, "-30", "2026-07-12");
  await insertTransaction(ME, courant, courses, "-40", "2026-06-20");
  await sql`select create_transfer(${ME}, ${courant}, ${livret}, 500, '2026-07-15', null)`;

  // Noise from another user that must never leak.
  const otherAcc = await insertAccount(OTHER, "Autre");
  const otherCat = await insertCategory(OTHER, "Autre");
  await insertTransaction(OTHER, otherAcc, otherCat, "-999", "2026-07-10");
});

describe("data queries", () => {
  it("returns balances as numbers, transfers included", async () => {
    const rows = await queries.accountBalances(ME);
    expect(rows.map((r) => [r.name, r.balance])).toEqual([
      ["Courant", 1000 + 2000 - 120.5 - 30 - 40 - 500],
      ["Livret", 1500],
    ]);
    expect(typeof rows[0].initial_balance).toBe("number");
  });

  it("totals a month without counting transfers", async () => {
    expect(await queries.monthTotals(ME, JULY)).toEqual({
      total_income: 2000,
      total_expense: 150.5,
      net: 1849.5,
    });
    expect(await queries.monthTotals(ME, { year: "2025", month: "1" })).toEqual({
      total_income: 0,
      total_expense: 0,
      net: 0,
    });
  });

  it("rolls expenses up to the root category", async () => {
    const rows = await queries.monthExpensesByCategory(ME, JULY);
    expect(rows).toEqual([
      expect.objectContaining({ category_name: "Alimentation", total: 150.5 }),
    ]);
  });

  it("lists a month's transactions with names and text dates", async () => {
    const rows = await queries.transactions(ME, { ...JULY, account: "all" });
    expect(rows).toHaveLength(5); // 3 regular + 2 transfer legs
    expect(rows[0]).toMatchObject({ date: "2026-07-15", category_name: null });
    expect(rows.find((r) => r.category_id === courses)).toMatchObject({
      account_name: "Courant",
      category_name: "Courses",
      amount: -120.5,
      date: "2026-07-10",
    });

    const livretOnly = await queries.transactions(ME, { ...JULY, account: livret });
    expect(livretOnly).toHaveLength(1);
  });

  it("never returns another user's rows", async () => {
    const all = await Promise.all([
      queries.accountOptions(ME),
      queries.categories(ME),
      queries.expenseHistory(ME),
      queries.recentTransactions(ME, JULY),
    ]);
    expect(JSON.stringify(all)).not.toContain("Autre");
    expect(JSON.stringify(all)).not.toContain("999");
  });

  it("rejects malformed params", async () => {
    await expect(queries.monthTotals(ME, { year: "x", month: "13" })).rejects.toBeInstanceOf(
      BadRequest,
    );
    await expect(
      queries.transactions(ME, { ...JULY, account: "'; drop table x;--" }),
    ).rejects.toBeInstanceOf(BadRequest);
  });
});
