import { CalendarClock } from "lucide-react";
import {
  daysUntil,
  isoDay,
  relativeDue,
  urgency,
} from "@/domain/holdings";
import { cn } from "@/lib/utils";

const TONE = {
  overdue: "bg-destructive/12 text-destructive ring-destructive/25",
  soon: "bg-ember/12 text-ember ring-ember/25",
  upcoming: "bg-amber/10 text-amber ring-amber/20",
  later: "bg-white/[0.04] text-muted-foreground ring-white/10",
} as const;

/** Countdown to a due date, toned by how close it is. */
export function DueChip({
  dueDate,
  className,
}: {
  dueDate: string;
  className?: string;
}) {
  const days = daysUntil(dueDate, isoDay(new Date()));
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ring-1",
        TONE[urgency(days)],
        className,
      )}
    >
      <CalendarClock className="size-3" />
      {relativeDue(days)}
    </span>
  );
}
