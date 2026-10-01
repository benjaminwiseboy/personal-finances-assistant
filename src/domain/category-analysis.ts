export type CatMonthRow = {
  category_root_id: string;
  category_name: string;
  year: number;
  month: number;
  total: number;
};

export type StackSegment = {
  id: string;
  name: string;
  value: number;
  /** Index into the categorical palette; null = "Autres" (neutral). */
  colorIndex: number | null;
};

export type MonthStack = {
  year: number;
  month: number;
  total: number;
  segments: StackSegment[];
};

export type LegendEntry = {
  id: string;
  name: string;
  colorIndex: number | null;
  total: number;
};

export type CategoryAnalysis = {
  months: MonthStack[];
  legend: LegendEntry[];
  autresTotal: number;
  periodTotal: number;
  max: number;
};

const SHOWN = 6;
const PALETTE_SIZE = 8;

function monthKey(year: number, month: number) {
  return `${year}-${month}`;
}

/**
 * Shapes raw category×month spending into a stacked series + ranked legend for
 * the last `monthsBack` months.
 *
 * Colours follow the category, not its rank in the selected window: a stable
 * colour index is assigned from all-time totals, so changing the period never
 * repaints the surviving categories. The charts still show the biggest N of the
 * selected window; everything else folds into "Autres".
 */
export function buildCategoryAnalysis(
  rows: CatMonthRow[],
  ref: { year: number; month: number },
  monthsBack: number,
): CategoryAnalysis {
  const names = new Map<string, string>();
  const allTotals = new Map<string, number>();
  for (const r of rows) {
    names.set(r.category_root_id, r.category_name);
    allTotals.set(
      r.category_root_id,
      (allTotals.get(r.category_root_id) ?? 0) + r.total,
    );
  }
  const rankedAllTime = [...allTotals.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => id);
  const colorIndexFor = (id: string): number | null => {
    const i = rankedAllTime.indexOf(id);
    return i >= 0 && i < PALETTE_SIZE ? i : null;
  };

  // Window of months (oldest → newest).
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
  const inPeriod = new Set(months.map((mm) => monthKey(mm.year, mm.month)));

  // Category totals within the window → choose which to show.
  const periodTotals = new Map<string, number>();
  const byMonthCat = new Map<string, Map<string, number>>();
  for (const r of rows) {
    const key = monthKey(r.year, r.month);
    if (!inPeriod.has(key)) continue;
    periodTotals.set(
      r.category_root_id,
      (periodTotals.get(r.category_root_id) ?? 0) + r.total,
    );
    if (!byMonthCat.has(key)) byMonthCat.set(key, new Map());
    byMonthCat.get(key)!.set(r.category_root_id, r.total);
  }
  const shownIds = [...periodTotals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, SHOWN)
    .map(([id]) => id);
  const shownSet = new Set(shownIds);

  const monthStacks: MonthStack[] = months.map((mm) => {
    const catTotals = byMonthCat.get(monthKey(mm.year, mm.month)) ?? new Map();
    const segments: StackSegment[] = shownIds.map((id) => ({
      id,
      name: names.get(id) ?? "",
      value: catTotals.get(id) ?? 0,
      colorIndex: colorIndexFor(id),
    }));
    let autres = 0;
    for (const [cid, v] of catTotals) if (!shownSet.has(cid)) autres += v;
    if (autres > 0) {
      segments.push({ id: "__autres__", name: "Autres", value: autres, colorIndex: null });
    }
    const total = segments.reduce((s, seg) => s + seg.value, 0);
    return { year: mm.year, month: mm.month, total, segments };
  });

  const legend: LegendEntry[] = shownIds.map((id) => ({
    id,
    name: names.get(id) ?? "",
    colorIndex: colorIndexFor(id),
    total: periodTotals.get(id) ?? 0,
  }));

  let autresTotal = 0;
  for (const [id, v] of periodTotals) if (!shownSet.has(id)) autresTotal += v;

  const periodTotal = [...periodTotals.values()].reduce((s, v) => s + v, 0);
  const max = Math.max(...monthStacks.map((s) => s.total), 0);

  return { months: monthStacks, legend, autresTotal, periodTotal, max };
}
