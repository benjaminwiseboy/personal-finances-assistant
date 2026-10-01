import { cn } from "@/lib/utils";

export function Wordmark({
  className,
  size = "default",
}: {
  className?: string;
  size?: "default" | "lg";
}) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <span
        aria-hidden
        className={cn(
          "flex items-center justify-center rounded-xl bg-gradient-to-br from-amber to-ember font-display font-bold text-[oklch(0.16_0.02_45)] shadow-lg shadow-ember/25 ring-1 ring-white/20",
          size === "lg" ? "size-12 text-2xl" : "size-8 text-base",
        )}
      >
        €
      </span>
      <span
        className={cn(
          "font-display font-semibold tracking-tight",
          size === "lg" ? "text-xl" : "text-[0.95rem]",
        )}
      >
        Mes Finances
      </span>
    </span>
  );
}
