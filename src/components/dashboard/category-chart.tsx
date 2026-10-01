import { formatMoney } from "@/lib/money";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type CategorySlice = { category_name: string; total: number };

const VISIBLE_ROWS = 7;

/**
 * Spending by category, ranked. One series, one hue — the bar length carries
 * the magnitude, so there is nothing for a legend to explain.
 */
export function CategoryChart({ data }: { data: CategorySlice[] }) {
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Où part l’argent</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Aucune dépense ce mois-ci. Ajoutez une transaction pour voir la
          répartition.
        </CardContent>
      </Card>
    );
  }

  const sorted = [...data].sort((a, b) => b.total - a.total);
  const rows =
    sorted.length > VISIBLE_ROWS
      ? [
          ...sorted.slice(0, VISIBLE_ROWS),
          {
            category_name: "Autres",
            total: sorted
              .slice(VISIBLE_ROWS)
              .reduce((acc, row) => acc + row.total, 0),
          },
        ]
      : sorted;

  const total = sorted.reduce((acc, row) => acc + row.total, 0);
  const max = Math.max(...rows.map((row) => row.total), 1);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Où part l’argent</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {rows.map((row) => {
          const share = total > 0 ? row.total / total : 0;
          return (
            <div key={row.category_name} className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between gap-4">
                <span className="truncate text-sm text-foreground">
                  {row.category_name}
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
                  className="h-full rounded-full bg-gradient-to-r from-ember-data to-amber"
                  style={{ width: `${(row.total / max) * 100}%` }}
                />
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
