"use client";

import { useState } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import type { MonthStack } from "@/domain/category-analysis";
import { formatMoney } from "@/lib/money";
import { categoryColor } from "./palette";

type Hover = {
  monthIdx: number;
  name: string;
  value: number;
  colorIndex: number | null;
  monthLabel: string;
} | null;

const shortMonth = (y: number, m: number) =>
  format(new Date(y, m - 1, 1), "MMM", { locale: fr });
const longMonth = (y: number, m: number) =>
  format(new Date(y, m - 1, 1), "MMMM yyyy", { locale: fr });

/**
 * Monthly spending stacked by category. CSS-driven bars with a 2px surface gap
 * between segments (so adjacent hues never touch — the secondary encoding the
 * palette relies on) and a per-segment hover tooltip.
 */
export function StackedBarChart({
  months,
  max,
}: {
  months: MonthStack[];
  max: number;
}) {
  const [hover, setHover] = useState<Hover>(null);

  if (max <= 0) {
    return (
      <div className="flex h-56 items-center justify-center text-sm text-muted-foreground">
        Aucune dépense sur cette période.
      </div>
    );
  }

  return (
    <div className="relative">
      {hover && (
        <div
          className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 -translate-y-1 rounded-lg bg-popover px-2.5 py-1.5 shadow-xl ring-1 ring-white/12"
          style={{
            left: `${((hover.monthIdx + 0.5) / months.length) * 100}%`,
          }}
        >
          <div className="font-mono text-[0.625rem] tracking-wide text-muted-foreground uppercase">
            {hover.monthLabel}
          </div>
          <div className="flex items-center gap-1.5 whitespace-nowrap">
            <span
              aria-hidden
              className="size-2 rounded-[3px]"
              style={{ backgroundColor: categoryColor(hover.colorIndex) }}
            />
            <span className="text-sm">{hover.name}</span>
            <span data-slot="figure" className="text-sm font-semibold">
              {formatMoney(hover.value)}
            </span>
          </div>
        </div>
      )}

      <div className="flex h-56 items-end gap-2 pt-8">
        {months.map((month, monthIdx) => {
          const visible = month.segments.filter((s) => s.value > 0);
          return (
            <div key={monthIdx} className="flex h-full flex-1 flex-col justify-end">
              <div
                className="flex flex-col-reverse gap-0.5"
                style={{ height: `${(month.total / max) * 100}%` }}
              >
                {visible.map((seg, segIdx) => (
                  <div
                    key={seg.id}
                    role="img"
                    aria-label={`${longMonth(month.year, month.month)}, ${seg.name} ${formatMoney(seg.value)}`}
                    onPointerEnter={() =>
                      setHover({
                        monthIdx,
                        name: seg.name,
                        value: seg.value,
                        colorIndex: seg.colorIndex,
                        monthLabel: longMonth(month.year, month.month),
                      })
                    }
                    onPointerLeave={() => setHover(null)}
                    className={`min-h-0.5 w-full transition-opacity hover:opacity-85 ${
                      segIdx === visible.length - 1 ? "rounded-t-md" : ""
                    }`}
                    style={{
                      flexGrow: seg.value,
                      backgroundColor: categoryColor(seg.colorIndex),
                    }}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-2 flex gap-2">
        {months.map((month, i) => (
          <span
            key={i}
            className="flex-1 text-center font-mono text-[0.5625rem] tracking-wide text-muted-foreground uppercase"
          >
            {shortMonth(month.year, month.month)}
          </span>
        ))}
      </div>
    </div>
  );
}
