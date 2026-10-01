import { budgetStatus } from "@/domain/budgets";
import { formatMoney } from "@/lib/money";
import { BudgetBar } from "./budget-bar";

/**
 * Month-level roll-up across every budget: total budgeted vs total spent.
 */
export function BudgetSummary({
  totalBudget,
  totalSpent,
}: {
  totalBudget: number;
  totalSpent: number;
}) {
  const status = budgetStatus(totalBudget, totalSpent);
  const over = status.state === "over";

  return (
    <section className="surface relative overflow-hidden rounded-2xl bg-card p-6 ring-1 ring-white/10 md:p-7">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-20 -right-16 size-64 rounded-full bg-ember/12 blur-3xl"
      />
      <div className="relative flex flex-col gap-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-1">
            <span className="font-mono text-[0.6875rem] tracking-[0.18em] text-muted-foreground uppercase">
              Dépensé ce mois
            </span>
            <span
              data-slot="figure"
              className={`font-display text-4xl leading-none font-semibold tracking-tight ${
                over ? "text-destructive" : "text-foreground"
              }`}
            >
              {formatMoney(status.spent)}
            </span>
          </div>
          <span className="font-display text-lg text-muted-foreground">
            sur {formatMoney(status.amount)}
          </span>
        </div>

        <BudgetBar ratio={status.ratio} state={status.state} className="h-2.5" />

        <p className="text-sm text-muted-foreground">
          {status.amount === 0
            ? "Aucun budget défini pour l’instant."
            : over
              ? `Tu as dépassé ton budget total de ${formatMoney(-status.remaining)}.`
              : `Il te reste ${formatMoney(status.remaining)} sur l’ensemble de tes budgets.`}
        </p>
      </div>
    </section>
  );
}
