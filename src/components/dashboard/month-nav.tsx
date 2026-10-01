"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const MONTH_LABELS = [
  "Janvier",
  "Février",
  "Mars",
  "Avril",
  "Mai",
  "Juin",
  "Juillet",
  "Août",
  "Septembre",
  "Octobre",
  "Novembre",
  "Décembre",
];

export function MonthNav({
  year,
  month,
  onChange,
}: {
  year: number;
  month: number;
  onChange: (year: number, month: number) => void;
}) {
  function goPrev() {
    if (month === 1) onChange(year - 1, 12);
    else onChange(year, month - 1);
  }

  function goNext() {
    if (month === 12) onChange(year + 1, 1);
    else onChange(year, month + 1);
  }

  return (
    <div className="flex items-center gap-1 rounded-full bg-white/[0.04] p-1 ring-1 ring-white/10">
      <Button
        variant="ghost"
        size="icon-sm"
        className="rounded-full"
        onClick={goPrev}
        aria-label="Mois précédent"
      >
        <ChevronLeft />
      </Button>
      <span className="min-w-36 text-center font-display text-sm font-medium tracking-tight">
        {MONTH_LABELS[month - 1]} {year}
      </span>
      <Button
        variant="ghost"
        size="icon-sm"
        className="rounded-full"
        onClick={goNext}
        aria-label="Mois suivant"
      >
        <ChevronRight />
      </Button>
    </div>
  );
}
