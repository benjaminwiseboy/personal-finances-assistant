import { describe, expect, it } from "vitest";
import Decimal from "decimal.js";
import { formatMoney, sum, toDecimal } from "@/lib/money";

describe("money", () => {
  it("converts a number or string to a Decimal", () => {
    expect(toDecimal(1500.5).toString()).toBe("1500.5");
    expect(toDecimal("1500.50").toString()).toBe("1500.5");
  });

  it("sums a list of values with decimal precision", () => {
    const result = sum([0.1, 0.2, "0.3"]);
    expect(result.toString()).toBe("0.6");
  });

  it("sums an empty list to zero", () => {
    expect(sum([]).toString()).toBe("0");
  });

  it("formats a positive amount as EUR currency", () => {
    expect(formatMoney(1234.5)).toBe("1 234,50 €");
  });

  it("formats a negative amount as EUR currency", () => {
    expect(formatMoney(-50)).toBe("-50,00 €");
  });

  it("rounds to 2 decimal places", () => {
    expect(formatMoney(new Decimal("10.006"))).toBe("10,01 €");
  });
});
