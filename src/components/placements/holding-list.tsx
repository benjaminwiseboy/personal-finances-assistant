"use client";

import { ChevronRight } from "lucide-react";
import {
  expectedGain,
  formatAmount,
  formatCompact,
  formatDue,
  formatPct,
  isOpen,
  statusLabel,
  toEur,
  type HoldingStatus,
} from "@/domain/holdings";
import { formatMoney } from "@/lib/money";
import type { HoldingRow } from "@/server/queries";
import { cn } from "@/lib/utils";
import { DueChip } from "./due-chip";

const STATUS_TONE: Record<HoldingStatus, string> = {
  planned: "text-muted-foreground ring-white/10",
  sent: "text-amber ring-amber/25",
  active: "text-foreground ring-white/15",
  closed: "text-mint ring-mint/25",
  defaulted: "text-destructive ring-destructive/25",
};

function HoldingCard({ holding, onOpen }: { holding: HoldingRow; onOpen: () => void }) {
  const open = isOpen(holding.status);
  const gain = expectedGain(holding.amount, holding.expected_return_pct, holding.return_period);

  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "glass group flex w-full flex-col gap-3 rounded-2xl bg-white/[0.04] p-4 text-left ring-1 ring-white/10 transition-colors",
        "hover:bg-white/[0.06] focus-visible:ring-2 focus-visible:ring-ember/60 focus-visible:outline-none",
        !open && "opacity-60",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate font-medium">{holding.name}</span>
          {holding.description && (
            <span className="line-clamp-1 text-xs text-muted-foreground">
              {holding.description}
            </span>
          )}
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ring-1",
            STATUS_TONE[holding.status],
          )}
        >
          {statusLabel(holding.kind, holding.status)}
        </span>
      </div>

      <div className="flex items-end justify-between gap-3">
        <div className="flex flex-col">
          <span data-slot="figure" className="font-display text-xl font-semibold tracking-tight">
            {formatAmount(holding.amount, holding.currency)}
          </span>
          {holding.currency === "XOF" && (
            <span data-slot="figure" className="text-xs text-muted-foreground">
              ≈ {formatMoney(toEur(holding.amount, "XOF"))}
            </span>
          )}
        </div>
        {gain && holding.expected_return_pct !== null && (
          <span
            data-slot="figure"
            className={cn(
              "text-right text-sm font-medium",
              holding.kind === "debt" ? "text-ember" : "text-mint",
            )}
          >
            {formatPct(holding.expected_return_pct)}
            {gain.perYear ? " / an" : ""}
            <span className="block text-xs font-normal text-muted-foreground">
              ≈ {formatCompact(gain.value, holding.currency)}
              {gain.perYear ? " par an" : ""}
            </span>
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-white/[0.06] pt-3 text-xs text-muted-foreground">
        {holding.due_date ? (
          <>
            <span>Échéance {formatDue(holding.due_date, holding.due_precision)}</span>
            {open && <DueChip dueDate={holding.due_date} />}
          </>
        ) : (
          <span>Sans échéance</span>
        )}
        <span className="ml-auto flex items-center gap-1">
          {holding.movement_count > 0
            ? `${holding.movement_count} mouvement${holding.movement_count > 1 ? "s" : ""}`
            : "Aucun compte lié"}
          <ChevronRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
        </span>
      </div>
    </button>
  );
}

export function HoldingList({
  title,
  holdings,
  empty,
  onOpen,
}: {
  title: string;
  holdings: HoldingRow[];
  empty: string;
  onOpen: (h: HoldingRow) => void;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-display text-lg font-semibold tracking-tight">
        {title}
        {holdings.length > 0 && (
          <span className="ml-2 font-mono text-xs font-normal text-muted-foreground">
            {holdings.length}
          </span>
        )}
      </h2>
      {holdings.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-white/10 px-4 py-6 text-center text-sm text-muted-foreground">
          {empty}
        </p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {holdings.map((h) => (
            <HoldingCard key={h.id} holding={h} onOpen={() => onOpen(h)} />
          ))}
        </div>
      )}
    </section>
  );
}
