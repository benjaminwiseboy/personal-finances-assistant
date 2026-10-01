import { formatMoney } from "@/lib/money";

/**
 * Dashboard headline. The big number is the real balance across every account
 * (carryover from prior months included) — always the true picture, so it never
 * reads negative just because this month's income hasn't landed yet. The
 * monthly flow (income vs expense) sits alongside, clearly scoped to "this
 * month", where an early-month deficit is informative rather than alarming.
 */
export function BalanceHero({
  balanceLabel,
  balanceValue,
  subline,
  totalIncome,
  totalExpense,
  net,
}: {
  balanceLabel: string;
  balanceValue: number;
  subline: string;
  totalIncome: number;
  totalExpense: number;
  net: number;
}) {
  const overspent = net < 0;
  const spentShare =
    totalIncome > 0
      ? Math.min(totalExpense / totalIncome, 1)
      : totalExpense > 0
        ? 1
        : 0;
  const hasActivity = totalIncome > 0 || totalExpense > 0;

  return (
    <section className="surface relative overflow-hidden rounded-2xl bg-card ring-1 ring-white/10">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -right-16 size-72 rounded-full bg-ember/12 blur-3xl"
      />
      <div className="relative grid gap-7 p-6 md:grid-cols-[1.1fr_1fr] md:gap-10 md:p-8">
        {/* Real balance — the reassuring, always-accurate figure */}
        <div className="flex flex-col justify-center gap-2">
          <span className="font-mono text-[0.6875rem] tracking-[0.18em] text-muted-foreground uppercase">
            {balanceLabel}
          </span>
          <p
            data-slot="figure"
            className={`font-display text-4xl leading-none font-semibold tracking-tight md:text-6xl ${
              balanceValue < 0 ? "text-ember" : "text-foreground"
            }`}
          >
            {formatMoney(balanceValue)}
          </p>
          <p className="text-sm text-muted-foreground">{subline}</p>
        </div>

        {/* This month's flow — scoped and labelled so an early-month deficit
            reads as context, not alarm */}
        <div className="flex flex-col gap-3 border-t border-white/[0.08] pt-6 md:border-t-0 md:border-l md:pt-0 md:pl-10">
          <span className="font-mono text-[0.6875rem] tracking-[0.18em] text-muted-foreground uppercase">
            Ce mois
          </span>

          <div
            role="img"
            aria-label={`${Math.round(spentShare * 100)} % des entrées dépensées`}
            className="flex h-2.5 w-full gap-0.5 overflow-hidden rounded-full bg-white/[0.06]"
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-ember-data to-ember transition-[width] duration-500"
              style={{ width: `${spentShare * 100}%` }}
            />
            {!overspent && spentShare < 1 && (
              <div className="h-full flex-1 rounded-full bg-mint-data/70" />
            )}
          </div>

          <dl className="flex flex-wrap items-center gap-x-8 gap-y-3">
            <Figure label="Entrées" value={totalIncome} tone="mint" />
            <Figure label="Sorties" value={totalExpense} tone="ember" />
          </dl>

          <p className="text-sm text-muted-foreground">
            {!hasActivity
              ? "Rien d’enregistré ce mois-ci."
              : overspent
                ? `Solde du mois : −${formatMoney(Math.abs(net))} · entrées à venir`
                : `Solde du mois : +${formatMoney(net)}`}
          </p>
        </div>
      </div>
    </section>
  );
}

function Figure({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "mint" | "ember";
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        aria-hidden
        className={`size-2.5 shrink-0 rounded-full ring-2 ring-card ${
          tone === "mint" ? "bg-mint-data" : "bg-ember"
        }`}
      />
      <div className="flex flex-col">
        <dt className="font-mono text-[0.625rem] tracking-[0.14em] text-muted-foreground uppercase">
          {label}
        </dt>
        <dd
          data-slot="figure"
          className="font-display text-lg font-semibold tracking-tight"
        >
          {formatMoney(value)}
        </dd>
      </div>
    </div>
  );
}
