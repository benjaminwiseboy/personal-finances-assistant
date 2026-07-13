import { describe, expect, it } from "vitest";
import {
  AccountFormSchema,
  CategoryFormSchema,
  TransactionFormSchema,
  TransferFormSchema,
} from "@/domain/validators";

describe("AccountFormSchema", () => {
  it("accepts a valid account", () => {
    const result = AccountFormSchema.safeParse({
      name: "Compte courant",
      type: "courant",
      initial_balance: "1000",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an empty name", () => {
    const result = AccountFormSchema.safeParse({
      name: "",
      type: "courant",
      initial_balance: "0",
    });
    expect(result.success).toBe(false);
  });

  it("normalizes comma decimal separator to dot", () => {
    const result = AccountFormSchema.safeParse({
      name: "Livret A",
      type: "livret",
      initial_balance: "1500,75",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.initial_balance).toBe("1500.75");
    }
  });
});

describe("CategoryFormSchema", () => {
  it("accepts a root category with no parent", () => {
    const result = CategoryFormSchema.safeParse({
      name: "Alimentation",
      type: "expense",
      parent_id: "",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.parent_id).toBeNull();
    }
  });

  it("rejects an invalid type", () => {
    const result = CategoryFormSchema.safeParse({
      name: "Alimentation",
      type: "invalid",
      parent_id: "",
    });
    expect(result.success).toBe(false);
  });
});

describe("TransactionFormSchema", () => {
  it("accepts a valid transaction", () => {
    const result = TransactionFormSchema.safeParse({
      account_id: "11111111-1111-1111-8111-111111111111",
      category_id: "22222222-2222-2222-8222-222222222222",
      amount: "42.50",
      date: "2026-07-13",
      description: "Courses",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a zero amount (e.g. a balance adjustment)", () => {
    const result = TransactionFormSchema.safeParse({
      account_id: "11111111-1111-1111-8111-111111111111",
      category_id: "22222222-2222-2222-8222-222222222222",
      amount: "0",
      date: "2026-07-13",
      description: "Régularisation",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a negative amount", () => {
    const result = TransactionFormSchema.safeParse({
      account_id: "11111111-1111-1111-8111-111111111111",
      category_id: "22222222-2222-2222-8222-222222222222",
      amount: "-5",
      date: "2026-07-13",
      description: "Courses",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an empty description", () => {
    const result = TransactionFormSchema.safeParse({
      account_id: "11111111-1111-1111-8111-111111111111",
      category_id: "22222222-2222-2222-8222-222222222222",
      amount: "10",
      date: "2026-07-13",
      description: "",
    });
    expect(result.success).toBe(false);
  });
});

describe("TransferFormSchema", () => {
  const base = {
    from_account_id: "11111111-1111-1111-8111-111111111111",
    to_account_id: "22222222-2222-2222-8222-222222222222",
    amount: "100",
    date: "2026-07-13",
    description: "",
  };

  it("accepts a valid transfer", () => {
    expect(TransferFormSchema.safeParse(base).success).toBe(true);
  });

  it("rejects when source and destination accounts are the same", () => {
    const result = TransferFormSchema.safeParse({
      ...base,
      to_account_id: base.from_account_id,
    });
    expect(result.success).toBe(false);
  });

  it("rejects a non-positive amount", () => {
    const result = TransferFormSchema.safeParse({ ...base, amount: "0" });
    expect(result.success).toBe(false);
  });
});
