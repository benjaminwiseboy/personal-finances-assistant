import Link from "next/link";
import { ArrowRight, ShieldCheck } from "lucide-react";
import type { BudgetView } from "@/components/budgets/budget-list";
import { formatMoney } from "@/lib/money";
import { BudgetBar } from "@/components/budgets/budget-bar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Compact dashboard strip: budgets nearing or past their limit this month.
 * Renders nothing when the user has no budgets yet.
 */
export function BudgetWatch({
  atRisk,
  hasBudgets,
}: {
  atRisk: BudgetView[];
  hasBudgets: boolean;
}) {
  if (!hasBudgets) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Budgets à surveiller
          <Link
            href="/budgets"
            className="flex items-center gap-1 text-xs font-normal text-muted-foreground transition-colors hover:text-foreground"
          >
            Tout voir
            <ArrowRight className="size-3" />
          </Link>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {atRisk.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <ShieldCheck className="size-4 text-mint" />
            Tout est sous contrôle ce mois-ci.
          </div>
        ) : (
          atRisk.map((b) => {
            const over = b.status.state === "over";
            return (
              <div key={b.id} className="flex flex-col gap-1.5">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="truncate text-sm">{b.category_name}</span>
                  <span
                    data-slot="figure"
                    className={`shrink-0 text-sm font-medium ${
                      over ? "text-destructive" : "text-foreground"
                    }`}
                  >
                    {formatMoney(b.status.spent)}
                    <span className="text-muted-foreground">
                      {" "}
                      / {formatMoney(b.status.amount)}
                    </span>
                  </span>
                </div>
                <BudgetBar
                  ratio={b.status.ratio}
                  state={b.status.state}
                  className="h-1.5"
                />
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
