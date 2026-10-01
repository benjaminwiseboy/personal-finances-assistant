import { describe, expect, it } from "vitest";
import {
  buildCategoryAnalysis,
  type CatMonthRow,
} from "@/domain/category-analysis";

const rows: CatMonthRow[] = [
  { category_root_id: "a", category_name: "Logement", year: 2026, month: 7, total: 800 },
  { category_root_id: "b", category_name: "Courses", year: 2026, month: 7, total: 400 },
  { category_root_id: "a", category_name: "Logement", year: 2026, month: 6, total: 800 },
  { category_root_id: "c", category_name: "Loisirs", year: 2026, month: 6, total: 100 },
];

describe("buildCategoryAnalysis", () => {
  it("spans the requested window newest-last", () => {
    const a = buildCategoryAnalysis(rows, { year: 2026, month: 7 }, 3);
    expect(a.months.map((m) => `${m.year}-${m.month}`)).toEqual([
      "2026-5",
      "2026-6",
      "2026-7",
    ]);
    expect(a.months[0].total).toBe(0); // May: no data
    expect(a.months[2].total).toBe(1200); // July: 800 + 400
  });

  it("assigns palette colours by all-time rank (Logement biggest → slot 0)", () => {
    const a = buildCategoryAnalysis(rows, { year: 2026, month: 7 }, 3);
    const logement = a.legend.find((l) => l.id === "a");
    const courses = a.legend.find((l) => l.id === "b");
    expect(logement?.colorIndex).toBe(0);
    expect(courses?.colorIndex).toBe(1);
  });

  it("buckets categories beyond the top 6 into Autres", () => {
    const many: CatMonthRow[] = Array.from({ length: 9 }, (_, i) => ({
      category_root_id: `c${i}`,
      category_name: `Cat ${i}`,
      year: 2026,
      month: 7,
      total: 100 - i, // c0 biggest … c8 smallest
    }));
    const a = buildCategoryAnalysis(many, { year: 2026, month: 7 }, 1);
    expect(a.legend).toHaveLength(6);
    expect(a.autresTotal).toBe(94 + 93 + 92); // c6 + c7 + c8 (total = 100 − i)
    const july = a.months[0];
    const autresSeg = july.segments.find((s) => s.id === "__autres__");
    expect(autresSeg?.value).toBe(94 + 93 + 92);
    expect(autresSeg?.colorIndex).toBeNull();
  });

  it("colours are stable across period changes", () => {
    const six = buildCategoryAnalysis(rows, { year: 2026, month: 7 }, 6);
    const three = buildCategoryAnalysis(rows, { year: 2026, month: 7 }, 3);
    expect(six.legend.find((l) => l.id === "a")?.colorIndex).toBe(
      three.legend.find((l) => l.id === "a")?.colorIndex,
    );
  });
});
