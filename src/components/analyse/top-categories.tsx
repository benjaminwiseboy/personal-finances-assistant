import type { LegendEntry } from "@/domain/category-analysis";
import { formatMoney } from "@/lib/money";
import { categoryColor } from "./palette";

type Row = { id: string; name: string; colorIndex: number | null; total: number };

/**
 * Biggest spending categories over the selected window — the direct answer to
 * "where does most of my money go". Uses the same category colours as the
 * stacked chart so the two read as one system.
 */
export function TopCategories({
  legend,
  autresTotal,
  periodTotal,
}: {
  legend: LegendEntry[];
  autresTotal: number;
  periodTotal: number;
}) {
  const rows: Row[] = [...legend];
  if (autresTotal > 0) {
    rows.push({ id: "__autres__", name: "Autres", colorIndex: null, total: autresTotal });
  }

  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Aucune dépense sur cette période.
      </p>
    );
  }

  const max = Math.max(...rows.map((r) => r.total), 1);

  return (
    <div className="flex flex-col gap-4">
      {rows.map((row) => {
        const share = periodTotal > 0 ? row.total / periodTotal : 0;
        const color = categoryColor(row.colorIndex);
        return (
          <div key={row.id} className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-4">
              <span className="flex min-w-0 items-center gap-2">
                <span
                  aria-hidden
                  className="size-2.5 shrink-0 rounded-[3px]"
                  style={{ backgroundColor: color }}
                />
                <span className="truncate text-sm text-foreground">
                  {row.name}
                </span>
              </span>
              <span className="flex shrink-0 items-baseline gap-2">
                <span
                  data-slot="figure"
                  className="text-sm font-medium text-foreground"
                >
                  {formatMoney(row.total)}
                </span>
                <span
                  data-slot="figure"
                  className="w-9 text-right font-mono text-xs text-muted-foreground"
                >
                  {Math.round(share * 100)} %
                </span>
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.05]">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${(row.total / max) * 100}%`,
                  backgroundColor: color,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
