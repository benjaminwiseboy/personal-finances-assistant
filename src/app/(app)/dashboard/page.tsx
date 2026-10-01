"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { budgetStatus } from "@/domain/budgets";
import { fetchData } from "@/lib/fetch-data";
import { MonthNav } from "@/components/dashboard/month-nav";
import { BalanceHero } from "@/components/dashboard/balance-hero";
import { CategoryChart } from "@/components/dashboard/category-chart";
import { RecentTransactions } from "@/components/dashboard/recent-transactions";
import { BudgetWatch } from "@/components/dashboard/budget-watch";
import { UpcomingDue } from "@/components/dashboard/upcoming-due";
import type { BudgetView } from "@/components/budgets/budget-list";

export default function DashboardPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  // Balances across all accounts — carryover included, not month-scoped.
  const { data: balance = { total: 0, count: 0, primary: null } } = useQuery({
    queryKey: ["dashboard-balance"],
    queryFn: async () => {
      const rows = await fetchData("accountBalances");
      const primary = rows.find((r) => r.is_primary) ?? null;
      return {
        total: rows.reduce((sum, r) => sum + r.balance, 0),
        count: rows.length,
        primary,
      };
    },
  });

  // Headline = the primary account (day-to-day money) when one is set;
  // otherwise the total across all accounts.
  const hero = balance.primary
    ? {
        label: "Compte principal",
        value: balance.primary.balance,
        subline: balance.primary.name,
      }
    : {
        label: "Solde total",
        value: balance.total,
        subline:
          balance.count > 0
            ? `Réparti sur ${balance.count} compte${balance.count > 1 ? "s" : ""} · définis ton compte principal dans Comptes`
            : "Aucun compte pour l’instant.",
      };

  const { data: totals = { total_income: 0, total_expense: 0, net: 0 } } =
    useQuery({
      queryKey: ["dashboard-totals", year, month],
      queryFn: () => fetchData("monthTotals", { year, month }),
    });

  const { data: categoryData = [] } = useQuery({
    queryKey: ["dashboard-categories", year, month],
    queryFn: () => fetchData("monthExpensesByCategory", { year, month }),
  });

  const { data: recent = [] } = useQuery({
    queryKey: ["dashboard-recent", year, month],
    queryFn: () => fetchData("recentTransactions", { year, month }),
  });

  const { data: budgets = [] } = useQuery({
    queryKey: ["budgets"],
    queryFn: () => fetchData("budgets"),
  });

  const { data: budgetSpending = [] } = useQuery({
    queryKey: ["budget-spending", year, month],
    queryFn: () => fetchData("monthExpensesByCategory", { year, month }),
  });

  const atRiskBudgets: BudgetView[] = useMemo(() => {
    const spent = new Map(
      budgetSpending.map((r) => [r.category_root_id, r.total]),
    );
    return budgets
      .map((b) => ({
        id: b.id,
        category_id: b.category_id,
        category_name: b.category_name,
        status: budgetStatus(b.amount, spent.get(b.category_id) ?? 0),
      }))
      .filter((b) => b.status.state !== "ok")
      .sort((a, b) => b.status.rawRatio - a.status.rawRatio)
      .slice(0, 4);
  }, [budgets, budgetSpending]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          Tableau de bord
        </h1>
        <MonthNav
          year={year}
          month={month}
          onChange={(y, m) => {
            setYear(y);
            setMonth(m);
          }}
        />
      </div>
      <BalanceHero
        balanceLabel={hero.label}
        balanceValue={hero.value}
        subline={hero.subline}
        totalIncome={totals.total_income}
        totalExpense={totals.total_expense}
        net={totals.net}
      />
      <UpcomingDue />
      <BudgetWatch
        atRisk={atRiskBudgets}
        hasBudgets={budgets.length > 0}
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <CategoryChart data={categoryData} />
        <RecentTransactions transactions={recent} />
      </div>
    </div>
  );
}
