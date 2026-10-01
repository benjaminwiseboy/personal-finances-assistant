import { toDecimal } from "@/lib/money";

export type BudgetState = "ok" | "warning" | "over";

export type BudgetStatus = {
  amount: number;
  spent: number;
  remaining: number;
  /** Share of the budget consumed, clamped to [0, 1] for bar width. */
  ratio: number;
  /** Raw share, can exceed 1 when over budget. */
  rawRatio: number;
  state: BudgetState;
};

const WARNING_AT = 0.8;

/**
 * Consumption of a monthly budget. Pure and total: handles a zero/absent
 * budget (ratio 0, but any spending is "over") and negative rounding.
 */
export function budgetStatus(amount: number, spent: number): BudgetStatus {
  const amt = toDecimal(amount);
  const used = toDecimal(spent);
  const remaining = amt.minus(used).toNumber();

  if (amt.lte(0)) {
    return {
      amount: 0,
      spent: used.toNumber(),
      remaining,
      ratio: used.gt(0) ? 1 : 0,
      rawRatio: used.gt(0) ? 1 : 0,
      state: used.gt(0) ? "over" : "ok",
    };
  }

  const rawRatio = used.div(amt).toNumber();
  const ratio = Math.max(0, Math.min(rawRatio, 1));
  const state: BudgetState =
    rawRatio > 1 ? "over" : rawRatio >= WARNING_AT ? "warning" : "ok";

  return {
    amount: amt.toNumber(),
    spent: used.toNumber(),
    remaining,
    ratio,
    rawRatio,
    state,
  };
}
