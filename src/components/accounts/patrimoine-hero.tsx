import { TrendingDown, TrendingUp } from "lucide-react";
import type { ChartPoint } from "./net-worth-chart";
import { formatMoney } from "@/lib/money";
import { NetWorthChart } from "./net-worth-chart";

/**
 * Net-worth overview for the accounts page: the total across every account and
 * how it has moved over the charted window.
 */
export function PatrimoineHero({
  total,
  series,
}: {
  total: number;
  series: ChartPoint[];
}) {
  const first = series[0]?.value ?? total;
  const delta = total - first;
  const up = delta >= 0;
  const pct = first !== 0 ? (delta / Math.abs(first)) * 100 : 0;

  return (
    <section className="surface relative overflow-hidden rounded-2xl bg-card p-6 ring-1 ring-white/10 md:p-8">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -right-16 size-72 rounded-full bg-ember/12 blur-3xl"
      />
      <div className="relative flex flex-col gap-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-2">
            <span className="font-mono text-[0.6875rem] tracking-[0.18em] text-muted-foreground uppercase">
              Patrimoine total
            </span>
            <p
              data-slot="figure"
              className={`font-display text-4xl leading-none font-semibold tracking-tight md:text-6xl ${
                total < 0 ? "text-ember" : "text-foreground"
              }`}
            >
              {formatMoney(total)}
            </p>
          </div>

          {series.length >= 2 && (
            <div className="flex flex-col items-end gap-1">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-medium ring-1 ${
                  up
                    ? "bg-mint/10 text-mint ring-mint/20"
                    : "bg-destructive/10 text-destructive ring-destructive/20"
                }`}
              >
                {up ? (
                  <TrendingUp className="size-3.5" />
                ) : (
                  <TrendingDown className="size-3.5" />
                )}
                {up ? "+" : "−"}
                {formatMoney(Math.abs(delta))}
              </span>
              <span className="font-mono text-[0.625rem] tracking-wide text-muted-foreground uppercase">
                sur {series.length} mois · {up ? "+" : "−"}
                {Math.abs(pct).toFixed(1).replace(".", ",")} %
              </span>
            </div>
          )}
        </div>

        <NetWorthChart data={series} />
      </div>
    </section>
  );
}
