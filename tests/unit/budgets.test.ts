import { describe, expect, it } from "vitest";
import { budgetStatus } from "@/domain/budgets";
import { BudgetFormSchema } from "@/domain/validators";

describe("budgetStatus", () => {
  it("reports an under-budget category as ok", () => {
    const s = budgetStatus(400, 120);
    expect(s.state).toBe("ok");
    expect(s.remaining).toBe(280);
    expect(s.ratio).toBeCloseTo(0.3);
  });

  it("flags warning at 80% consumed", () => {
    expect(budgetStatus(100, 80).state).toBe("warning");
    expect(budgetStatus(100, 79).state).toBe("ok");
  });

  it("flags over when spending exceeds the budget", () => {
    const s = budgetStatus(200, 250);
    expect(s.state).toBe("over");
    expect(s.remaining).toBe(-50);
    expect(s.rawRatio).toBeCloseTo(1.25);
    expect(s.ratio).toBe(1); // clamped for the bar
  });

  it("treats spending against a zero budget as over", () => {
    expect(budgetStatus(0, 10).state).toBe("over");
    expect(budgetStatus(0, 0).state).toBe("ok");
  });

  it("keeps two-decimal money precision", () => {
    const s = budgetStatus(100.1, 33.37);
    expect(s.remaining).toBeCloseTo(66.73);
  });
});

describe("BudgetFormSchema", () => {
  const CATEGORY = "11111111-1111-4111-8111-111111111111";

  it("rejects a non-positive amount", () => {
    expect(
      BudgetFormSchema.safeParse({ category_id: CATEGORY, amount: "0" }).success,
    ).toBe(false);
    expect(
      BudgetFormSchema.safeParse({ category_id: CATEGORY, amount: "-5" }).success,
    ).toBe(false);
  });

  it("accepts a valid budget and normalizes the amount", () => {
    const parsed = BudgetFormSchema.safeParse({
      category_id: CATEGORY,
      amount: "400,50",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.amount).toBe("400.50");
  });

  it("requires a category", () => {
    expect(
      BudgetFormSchema.safeParse({ category_id: "", amount: "100" }).success,
    ).toBe(false);
  });
});
