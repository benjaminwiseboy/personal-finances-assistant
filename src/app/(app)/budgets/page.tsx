"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { budgetStatus } from "@/domain/budgets";
import { fetchData } from "@/lib/fetch-data";
import { MonthNav } from "@/components/dashboard/month-nav";
import {
  BudgetList,
  type BudgetView,
} from "@/components/budgets/budget-list";
import { BudgetForm } from "@/components/budgets/budget-form";
import { BudgetSummary } from "@/components/budgets/budget-summary";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type BudgetRow = { id: string; category_id: string; amount: number; category_name: string };
type CategoryOption = { id: string; name: string };

export default function BudgetsPage() {
  const queryClient = useQueryClient();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [creating, setCreating] = useState(false);

  const { data: budgets = [] } = useQuery({
    queryKey: ["budgets"],
    queryFn: () => fetchData("budgets"),
  });

  // Root expense categories, for the "add budget" picker.
  const { data: expenseCategories = [] } = useQuery({
    queryKey: ["categories", "expense-roots"],
    queryFn: () => fetchData("rootExpenseCategories"),
  });

  // Spending per root expense category for the selected month.
  const { data: spending = [] } = useQuery({
    queryKey: ["budget-spending", year, month],
    queryFn: () => fetchData("monthExpensesByCategory", { year, month }),
  });

  const spentByCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of spending) map.set(row.category_root_id, row.total);
    return map;
  }, [spending]);

  const views: BudgetView[] = useMemo(
    () =>
      budgets
        .map((b) => ({
          id: b.id,
          category_id: b.category_id,
          category_name: b.category_name,
          status: budgetStatus(b.amount, spentByCategory.get(b.category_id) ?? 0),
        }))
        .sort((a, b) => b.status.rawRatio - a.status.rawRatio),
    [budgets, spentByCategory],
  );

  const totals = useMemo(() => {
    let totalBudget = 0;
    let totalSpent = 0;
    for (const v of views) {
      totalBudget += v.status.amount;
      totalSpent += v.status.spent;
    }
    return { totalBudget, totalSpent };
  }, [views]);

  const budgetedIds = new Set(budgets.map((b) => b.category_id));
  const availableCategories = expenseCategories.filter(
    (c) => !budgetedIds.has(c.id),
  );

  function reload() {
    queryClient.invalidateQueries({ queryKey: ["budgets"] });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          Budgets
        </h1>
        <div className="flex flex-wrap items-center gap-3">
          <MonthNav
            year={year}
            month={month}
            onChange={(y, m) => {
              setYear(y);
              setMonth(m);
            }}
          />
          <Dialog open={creating} onOpenChange={setCreating}>
            <DialogTrigger
              render={<Button disabled={availableCategories.length === 0} />}
            >
              <Plus />
              Nouveau budget
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nouveau budget</DialogTitle>
              </DialogHeader>
              <BudgetForm
                availableCategories={availableCategories}
                onSuccess={() => {
                  setCreating(false);
                  reload();
                }}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <BudgetSummary
        totalBudget={totals.totalBudget}
        totalSpent={totals.totalSpent}
      />
      <BudgetList budgets={views} onChanged={reload} />
    </div>
  );
}
