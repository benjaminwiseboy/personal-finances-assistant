import { toDecimal } from "@/lib/money";

export type NetWorthPoint = { year: number; month: number; value: number };

export function monthKey(year: number, month: number): string {
  return `${year}-${month}`;
}

/**
 * Net worth at the end of each of the last `monthsBack` months, derived by
 * walking backwards from the known current total and undoing each month's net
 * flow. Building from `currentTotal` guarantees the series ends exactly on the
 * balance shown elsewhere (no drift between the headline and the chart).
 *
 * `netByMonth` maps monthKey(year, month) → that month's net flow (income −
 * expense, transfers excluded — they net to zero across accounts anyway).
 */
export function netWorthSeries(
  currentTotal: number,
  netByMonth: Map<string, number>,
  ref: { year: number; month: number },
  monthsBack = 12,
): NetWorthPoint[] {
  const months: { year: number; month: number }[] = [];
  let y = ref.year;
  let m = ref.month;
  for (let i = 0; i < monthsBack; i++) {
    months.unshift({ year: y, month: m });
    m -= 1;
    if (m === 0) {
      m = 12;
      y -= 1;
    }
  }

  const out: NetWorthPoint[] = months.map((mm) => ({ ...mm, value: 0 }));
  let running = toDecimal(currentTotal);
  for (let i = out.length - 1; i >= 0; i--) {
    out[i].value = running.toDecimalPlaces(2).toNumber();
    const net = netByMonth.get(monthKey(out[i].year, out[i].month)) ?? 0;
    running = running.minus(net);
  }
  return out;
}
