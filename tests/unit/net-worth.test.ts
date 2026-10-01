import { describe, expect, it } from "vitest";
import { monthKey, netWorthSeries } from "@/domain/net-worth";

describe("netWorthSeries", () => {
  it("ends exactly on the current total", () => {
    const series = netWorthSeries(5000, new Map(), { year: 2026, month: 7 }, 12);
    expect(series).toHaveLength(12);
    expect(series[series.length - 1].value).toBe(5000);
    expect(series[series.length - 1]).toMatchObject({ year: 2026, month: 7 });
  });

  it("undoes each month's net flow walking backwards", () => {
    // Current total 5000; this month +1000, last month −200.
    const net = new Map([
      [monthKey(2026, 7), 1000],
      [monthKey(2026, 6), -200],
    ]);
    const series = netWorthSeries(5000, net, { year: 2026, month: 7 }, 3);
    // [May, Jun, Jul]
    expect(series.map((p) => p.value)).toEqual([4200, 4000, 5000]);
    //  Jul = 5000; Jun end = 5000 − 1000 = 4000; May end = 4000 − (−200) = 4200
  });

  it("spans the correct 12-month window crossing a year boundary", () => {
    const series = netWorthSeries(0, new Map(), { year: 2026, month: 2 }, 12);
    expect(series[0]).toMatchObject({ year: 2025, month: 3 });
    expect(series[11]).toMatchObject({ year: 2026, month: 2 });
  });

  it("treats months with no recorded flow as unchanged", () => {
    const series = netWorthSeries(1000, new Map(), { year: 2026, month: 7 }, 4);
    expect(series.every((p) => p.value === 1000)).toBe(true);
  });
});
