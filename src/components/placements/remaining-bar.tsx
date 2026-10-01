import { cn } from "@/lib/utils";

/**
 * How much of the capital has come back (or, for a debt, been paid back).
 * Mint fills for money returning to you, ember for a debt being cleared.
 */
export function RemainingBar({
  ratio,
  debt,
  className,
}: {
  ratio: number;
  debt: boolean;
  className?: string;
}) {
  const pct = Math.round(Math.min(Math.max(ratio, 0), 1) * 100);
  return (
    <div
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={debt ? `${pct} % remboursé` : `${pct} % récupéré`}
      className={cn("h-1.5 overflow-hidden rounded-full bg-white/[0.06]", className)}
    >
      <div
        className={cn("h-full rounded-full", debt ? "bg-ember-data" : "bg-mint-data")}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
