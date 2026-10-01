"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  buildCategoryAnalysis,
  type CatMonthRow,
} from "@/domain/category-analysis";
import { fetchData } from "@/lib/fetch-data";
import { formatMoney } from "@/lib/money";
import { StackedBarChart } from "@/components/analyse/stacked-bar-chart";
import { TopCategories } from "@/components/analyse/top-categories";
import { categoryColor } from "@/components/analyse/palette";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const PERIODS = [3, 6, 12] as const;

export default function AnalysePage() {
  const now = new Date();
  const [months, setMonths] = useState<(typeof PERIODS)[number]>(6);

  const { data: rows = [] } = useQuery({
    queryKey: ["category-analysis"],
    queryFn: () => fetchData("expenseHistory"),
  });

  const analysis = useMemo(
    () =>
      buildCategoryAnalysis(
        rows,
        { year: now.getFullYear(), month: now.getMonth() + 1 },
        months,
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, months],
  );

  const legendEntries = [
    ...analysis.legend,
    ...(analysis.autresTotal > 0
      ? [{ id: "__autres__", name: "Autres", colorIndex: null, total: analysis.autresTotal }]
      : []),
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          Analyse
        </h1>
        <div className="flex gap-1 rounded-full bg-white/[0.04] p-1 ring-1 ring-white/10">
          {PERIODS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setMonths(p)}
              aria-pressed={months === p}
              className={cn(
                "rounded-full px-3 py-1.5 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ember/60 focus-visible:outline-none",
                months === p
                  ? "bg-ember/15 text-foreground ring-1 ring-ember/40"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {p} mois
            </button>
          ))}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-baseline justify-between gap-2">
            Dépenses par mois
            <span
              data-slot="figure"
              className="text-sm font-normal text-muted-foreground"
            >
              {formatMoney(analysis.periodTotal)} sur {months} mois
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <StackedBarChart months={analysis.months} max={analysis.max} />
          {legendEntries.length > 0 && (
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              {legendEntries.map((e) => (
                <span key={e.id} className="flex items-center gap-1.5 text-xs">
                  <span
                    aria-hidden
                    className="size-2.5 rounded-[3px]"
                    style={{ backgroundColor: categoryColor(e.colorIndex) }}
                  />
                  <span className="text-muted-foreground">{e.name}</span>
                </span>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tes plus gros postes</CardTitle>
        </CardHeader>
        <CardContent>
          <TopCategories
            legend={analysis.legend}
            autresTotal={analysis.autresTotal}
            periodTotal={analysis.periodTotal}
          />
        </CardContent>
      </Card>
    </div>
  );
}
