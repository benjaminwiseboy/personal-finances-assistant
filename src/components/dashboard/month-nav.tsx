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
    <div className="flex items-center gap-3">
      <Button variant="outline" size="icon" onClick={goPrev} aria-label="Mois précédent">
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <span className="min-w-40 text-center font-medium">
        {MONTH_LABELS[month - 1]} {year}
      </span>
      <Button variant="outline" size="icon" onClick={goNext} aria-label="Mois suivant">
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
