import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

/**
 * Headline for the page: what's out working for you vs what you owe, in
 * euros (FCFA converted at the fixed parity). Open holdings only.
 */
export function PlacementsSummary({
  invested,
  lent,
  owed,
}: {
  invested: number;
  lent: number;
  owed: number;
}) {
  const net = invested + lent - owed;
  const assets = invested + lent;
  const total = assets + owed;
  const assetShare = total > 0 ? (assets / total) * 100 : 50;

  return (
    <div className="surface flex flex-col gap-5 rounded-3xl bg-card p-6 ring-1 ring-white/10">
      <div className="flex flex-col gap-1">
        <span className="font-mono text-[0.7rem] tracking-[0.18em] text-muted-foreground uppercase">
          Position nette
        </span>
        <span
          data-slot="figure"
          className={cn(
            "font-display text-4xl font-semibold tracking-tight",
            net < 0 ? "text-ember" : "text-foreground",
          )}
        >
          {formatMoney(net)}
        </span>
        <span className="text-sm text-muted-foreground">
          Ce qu’on te doit encore moins ce que tu dois encore · en euros
        </span>
      </div>

      {total > 0 && (
        <div
          className="flex h-2 overflow-hidden rounded-full bg-white/[0.06]"
          role="img"
          aria-label={`${Math.round(assetShare)} % de créances, ${Math.round(100 - assetShare)} % de dettes`}
        >
          <div className="bg-mint-data" style={{ width: `${assetShare}%` }} />
          <div className="bg-ember-data" style={{ width: `${100 - assetShare}%` }} />
        </div>
      )}

      <dl className="grid grid-cols-3 gap-3">
        {(
          [
            ["Investi", invested, "bg-mint-data"],
            ["Prêté", lent, "bg-mint-data"],
            ["Dettes", owed, "bg-ember-data"],
          ] as const
        ).map(([label, value, dot]) => (
          <div key={label} className="flex flex-col gap-1">
            <dt className="flex items-center gap-1.5 font-mono text-[0.65rem] tracking-[0.14em] text-muted-foreground uppercase">
              <span aria-hidden className={cn("size-1.5 rounded-full", dot)} />
              {label}
            </dt>
            <dd data-slot="figure" className="text-sm font-medium sm:text-base">
              {formatMoney(value)}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
