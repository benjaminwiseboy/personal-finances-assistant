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

// Server actions run their real SQL against PGlite (see helpers/test-db).
const session = vi.hoisted(() => ({ userId: "me" as string | null }));
vi.mock("@/lib/db", async () => (await import("../helpers/test-db")).dbModule);
vi.mock("@/lib/session", () => ({ getUserId: async () => session.userId }));
// revalidatePath needs a Next.js request context; a no-op is enough here.
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import {
  createAccount,
  deleteAccount,
  setPrimaryAccount,
} from "@/actions/accounts";
import {
  createCategory,
  deleteCategory,
  updateCategory,
} from "@/actions/categories";
import {
  createTransaction,
  deleteTransaction,
  updateTransaction,
} from "@/actions/transactions";
import { createTransfer, deleteTransfer } from "@/actions/transfers";
import { createBudget } from "@/actions/budgets";

const ME = "me";
const OTHER = "other";

beforeEach(async () => {
  await reset();
  await createUser(ME);
  await createUser(OTHER);
  session.userId = ME;
});

async function countRows(table: string): Promise<number> {
  const { rows } = await pg.query<{ n: number }>(
    `select count(*)::int as n from ${table}`,
  );
  return rows[0].n;
}

describe("auth guard", () => {
  it("refuses every write when signed out", async () => {
    session.userId = null;
    const result = await createAccount({
      name: "X",
      type: "courant",
      initial_balance: "0",
    });
    expect(result.error).toBe("Non authentifié");
    expect(await countRows("accounts")).toBe(0);
  });
});

describe("accounts", () => {
  it("creates an account for the signed-in user", async () => {
    const result = await createAccount({
      name: "Livret A",
      type: "livret",
      initial_balance: "250,50",
    });
    expect(result.error).toBeUndefined();
    const [row] = await sql`select user_id, initial_balance::text as b from accounts`;
    expect(row).toEqual({ user_id: ME, b: "250.50" });
  });

  it("refuses to delete an account with existing transactions", async () => {
    const acc = await insertAccount(ME);
    const cat = await insertCategory(ME, "Courses");
    await insertTransaction(ME, acc, cat, "-10");

    const result = await deleteAccount(acc);
    expect(result.error).toMatch(/transactions/i);
    expect(await countRows("accounts")).toBe(1);
  });

  it("deletes an account with no transactions", async () => {
    const acc = await insertAccount(ME);
    expect((await deleteAccount(acc)).error).toBeUndefined();
    expect(await countRows("accounts")).toBe(0);
  });

  it("does not delete another user's account", async () => {
    const acc = await insertAccount(OTHER);
    await deleteAccount(acc);
    expect(await countRows("accounts")).toBe(1);
  });

  it("moves the primary flag atomically", async () => {
    const a = await insertAccount(ME, "A");
    const b = await insertAccount(ME, "B");
    expect((await setPrimaryAccount(a)).error).toBeUndefined();
    expect((await setPrimaryAccount(b)).error).toBeUndefined();
    const rows = await sql`select name from accounts where is_primary`;
    expect(rows).toEqual([{ name: "B" }]);
  });
});

describe("categories", () => {
  it("refuses to delete a category with transactions", async () => {
    const acc = await insertAccount(ME);
    const cat = await insertCategory(ME, "Courses");
    await insertTransaction(ME, acc, cat, "-10");
    expect((await deleteCategory(cat)).error).toMatch(/transactions/i);
  });

  it("refuses to delete a category with sub-categories", async () => {
    const root = await insertCategory(ME, "Maison");
    await insertCategory(ME, "Loyer", "expense", root);
    expect((await deleteCategory(root)).error).toMatch(/sous-catégories/i);
  });

  it("refuses a parent belonging to another user", async () => {
    const foreign = await insertCategory(OTHER, "Autre");
    const result = await createCategory({
      name: "Sous",
      type: "expense",
      parent_id: foreign,
    });
    expect(result.error).toMatch(/parente introuvable/i);
    expect(await countRows("categories")).toBe(1);
  });

  it("refuses a parent that is itself a sub-category", async () => {
    const root = await insertCategory(ME, "Maison");
    const child = await insertCategory(ME, "Loyer", "expense", root);
    const result = await createCategory({
      name: "Trop profond",
      type: "expense",
      parent_id: child,
    });
    expect(result.error).toMatch(/racine/i);
  });

  it("creates top-level and child categories", async () => {
    expect(
      (await createCategory({ name: "Maison", type: "expense", parent_id: "" }))
        .error,
    ).toBeUndefined();
    const [root] = await sql`select id from categories`;
    expect(
      (
        await createCategory({
          name: "Loyer",
          type: "expense",
          parent_id: root.id as string,
        })
      ).error,
    ).toBeUndefined();
    expect(await countRows("categories")).toBe(2);
  });

  it("refuses to set a category as its own parent", async () => {
    const cat = await insertCategory(ME, "Maison");
    const result = await updateCategory(cat, {
      name: "Maison",
      type: "expense",
      parent_id: cat,
    });
    expect(result.error).toMatch(/propre catégorie parente/i);
  });

  it("refuses to re-parent a category that already has children", async () => {
    const a = await insertCategory(ME, "A");
    await insertCategory(ME, "A1", "expense", a);
    const b = await insertCategory(ME, "B");
    const result = await updateCategory(a, {
      name: "A",
      type: "expense",
      parent_id: b,
    });
    expect(result.error).toMatch(/sous-catégories/i);
  });

  it("updates a category under a valid parent", async () => {
    const a = await insertCategory(ME, "A");
    const b = await insertCategory(ME, "B");
    const result = await updateCategory(a, {
      name: "A renommée",
      type: "expense",
      parent_id: b,
    });
    expect(result.error).toBeUndefined();
    const [row] = await sql`select name, parent_id from categories where id = ${a}`;
    expect(row).toEqual({ name: "A renommée", parent_id: b });
  });
});

describe("transactions", () => {
  it("signs the amount from the category type", async () => {
    const acc = await insertAccount(ME);
    const expense = await insertCategory(ME, "Courses");
    const income = await insertCategory(ME, "Salaire", "income");
    const base = { account_id: acc, date: "2026-07-13", description: "x" };

    await createTransaction({ ...base, category_id: expense, amount: "12,30" });
    await createTransaction({ ...base, category_id: income, amount: "2000" });

    const rows = await sql`select amount::text as a from transactions order by amount`;
    expect(rows).toEqual([{ a: "-12.30" }, { a: "2000.00" }]);
  });

  it("refuses an account belonging to another user", async () => {
    const foreignAcc = await insertAccount(OTHER);
    const cat = await insertCategory(ME, "Courses");
    const result = await createTransaction({
      account_id: foreignAcc,
      category_id: cat,
      amount: "10",
      date: "2026-07-13",
      description: "x",
    });
    expect(result.error).toBe("Compte introuvable");
  });

  it("refuses a category belonging to another user", async () => {
    const acc = await insertAccount(ME);
    const foreignCat = await insertCategory(OTHER, "Courses");
    const result = await createTransaction({
      account_id: acc,
      category_id: foreignCat,
      amount: "10",
      date: "2026-07-13",
      description: "x",
    });
    expect(result.error).toBe("Catégorie introuvable");
  });

  it("updates and deletes a regular transaction", async () => {
    const acc = await insertAccount(ME);
    const cat = await insertCategory(ME, "Courses");
    const tx = await insertTransaction(ME, acc, cat, "-10");

    const updated = await updateTransaction(tx, {
      account_id: acc,
      category_id: cat,
      amount: "25",
      date: "2026-07-14",
      description: "Marché",
    });
    expect(updated.error).toBeUndefined();
    const [row] = await sql`select amount::text as a, date::text as d, description from transactions`;
    expect(row).toEqual({ a: "-25.00", d: "2026-07-14", description: "Marché" });

    expect((await deleteTransaction(tx)).error).toBeUndefined();
    expect(await countRows("transactions")).toBe(0);
  });

  it("refuses to edit or delete a transfer leg", async () => {
    const a = await insertAccount(ME, "A");
    const b = await insertAccount(ME, "B");
    const cat = await insertCategory(ME, "Courses");
    await createTransfer({
      from_account_id: a,
      to_account_id: b,
      amount: "50",
      date: "2026-07-13",
      description: "",
    });
    const [leg] = await sql`select id from transactions limit 1`;
    const id = leg.id as string;

    expect((await deleteTransaction(id)).error).toMatch(/transfert/i);
    const updated = await updateTransaction(id, {
      account_id: a,
      category_id: cat,
      amount: "1",
      date: "2026-07-13",
      description: "x",
    });
    expect(updated.error).toMatch(/transfert/i);
    expect(await countRows("transactions")).toBe(2);
  });
});

describe("transfers", () => {
  it("rejects same-account transfers without touching the database", async () => {
    const a = await insertAccount(ME);
    const result = await createTransfer({
      from_account_id: a,
      to_account_id: a,
      amount: "100",
      date: "2026-07-13",
      description: "",
    });
    expect(result.error).toBeDefined();
    expect(await countRows("transfers")).toBe(0);
  });

  it("creates both legs, then deletes them with the transfer", async () => {
    const a = await insertAccount(ME, "A");
    const b = await insertAccount(ME, "B");
    const result = await createTransfer({
      from_account_id: a,
      to_account_id: b,
      amount: "150,50",
      date: "2026-07-13",
      description: "Épargne mensuelle",
    });
    expect(result.error).toBeUndefined();

    const legs = await sql`
      select account_id, amount::text as a, description
      from transactions order by amount`;
    expect(legs).toEqual([
      { account_id: a, a: "-150.50", description: "Épargne mensuelle" },
      { account_id: b, a: "150.50", description: "Épargne mensuelle" },
    ]);

    const [transfer] = await sql`select id from transfers`;
    expect((await deleteTransfer(transfer.id as string)).error).toBeUndefined();
    expect(await countRows("transactions")).toBe(0);
    expect(await countRows("transfers")).toBe(0);
  });

  it("refuses a transfer into another user's account", async () => {
    const a = await insertAccount(ME);
    const foreign = await insertAccount(OTHER);
    const result = await createTransfer({
      from_account_id: a,
      to_account_id: foreign,
      amount: "10",
      date: "2026-07-13",
      description: "",
    });
    expect(result.error).toBeDefined();
    expect(await countRows("transactions")).toBe(0);
  });

  it("refuses to delete another user's transfer", async () => {
    session.userId = OTHER;
    const a = await insertAccount(OTHER, "A");
    const b = await insertAccount(OTHER, "B");
    await createTransfer({
      from_account_id: a,
      to_account_id: b,
      amount: "10",
      date: "2026-07-13",
      description: "",
    });
    const [transfer] = await sql`select id from transfers`;

    session.userId = ME;
    expect((await deleteTransfer(transfer.id as string)).error).toBeDefined();
    expect(await countRows("transfers")).toBe(1);
  });
});

describe("budgets", () => {
  it("only budgets a root expense category, once", async () => {
    const root = await insertCategory(ME, "Maison");
    const child = await insertCategory(ME, "Loyer", "expense", root);
    const income = await insertCategory(ME, "Salaire", "income");

    expect((await createBudget({ category_id: child, amount: "100" })).error).toMatch(
      /principale/i,
    );
    expect((await createBudget({ category_id: income, amount: "100" })).error).toMatch(
      /dépense/i,
    );
    expect((await createBudget({ category_id: root, amount: "100" })).error).toBeUndefined();
    expect((await createBudget({ category_id: root, amount: "200" })).error).toBe(
      "Cette catégorie a déjà un budget",
    );
  });
});
