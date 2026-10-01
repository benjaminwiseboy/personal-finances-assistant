import type { BudgetState } from "@/domain/budgets";
import { cn } from "@/lib/utils";

const FILL: Record<BudgetState, string> = {
  ok: "bg-gradient-to-r from-ember-data to-ember",
  warning: "bg-gradient-to-r from-amber to-[oklch(0.85_0.14_82)]",
  over: "bg-gradient-to-r from-destructive to-[oklch(0.72_0.2_25)]",
};

export function BudgetBar({
  ratio,
  state,
  className,
}: {
  ratio: number;
  state: BudgetState;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "h-2 w-full overflow-hidden rounded-full bg-white/[0.06]",
        className,
      )}
    >
      <div
        className={cn("h-full rounded-full transition-[width] duration-500", FILL[state])}
        style={{ width: `${ratio * 100}%` }}
      />
    </div>
  );
}
