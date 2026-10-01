"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { KIND_LABELS, formatAmount, formatDue, outstanding } from "@/domain/holdings";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DueChip } from "@/components/placements/due-chip";
import { useUpcomingDue } from "@/components/placements/use-upcoming-due";

/**
 * Placements, loans and debts coming due in the next 60 days, most urgent
 * first. Hidden when there's nothing on the horizon.
 */
export function UpcomingDue() {
  const { items } = useUpcomingDue();
  if (items.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Échéances à venir
          <Link
            href="/placements"
            className="flex items-center gap-1 text-xs font-normal text-muted-foreground transition-colors hover:text-foreground"
          >
            Tout voir
            <ArrowRight className="size-3" />
          </Link>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col">
        {items.slice(0, 4).map((h) => (
          <Link
            key={h.id}
            href="/placements"
            className="flex items-center gap-3 border-b border-white/[0.06] py-3 first:pt-0 last:border-0 last:pb-0"
          >
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="truncate text-sm">{h.name}</span>
              <span className="text-xs text-muted-foreground">
                {KIND_LABELS[h.kind]} · {formatDue(h.due_date!, h.due_precision)}
              </span>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <span data-slot="figure" className="text-sm font-medium">
                {formatAmount(outstanding(h.amount, h.repaid, h.currency).remaining, h.currency)}
              </span>
              <DueChip dueDate={h.due_date!} />
            </div>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
