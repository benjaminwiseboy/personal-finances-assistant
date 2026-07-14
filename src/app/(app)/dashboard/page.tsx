"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { MonthNav } from "@/components/dashboard/month-nav";
import { KpiCards } from "@/components/dashboard/kpi-cards";
import { CategoryChart } from "@/components/dashboard/category-chart";
import { RecentTransactions } from "@/components/dashboard/recent-transactions";

export default function DashboardPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const { data: totals = { total_income: 0, total_expense: 0, net: 0 } } =
    useQuery({
      queryKey: ["dashboard-totals", year, month],
      queryFn: async () => {
        const supabase = createClient();
        const { data } = await supabase
          .from("v_monthly_totals")
          .select("total_income, total_expense, net")
          .eq("year", year)
          .eq("month", month)
          .maybeSingle();
        return data ?? { total_income: 0, total_expense: 0, net: 0 };
      },
    });

  const { data: categoryData = [] } = useQuery({
    queryKey: ["dashboard-categories", year, month],
    queryFn: async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("v_category_monthly_summary")
        .select("category_name, total")
        .eq("year", year)
        .eq("month", month)
        .eq("type", "expense")
        .order("total", { ascending: false });
      return (data ?? []) as { category_name: string; total: number }[];
    },
  });

  const { data: recent = [] } = useQuery({
    queryKey: ["dashboard-recent", year, month],
    queryFn: async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("transactions")
        .select("id, date, description, amount")
        .gte("date", `${year}-${String(month).padStart(2, "0")}-01`)
        .lt(
          "date",
          month === 12
            ? `${year + 1}-01-01`
            : `${year}-${String(month + 1).padStart(2, "0")}-01`,
        )
        .order("date", { ascending: false })
        .limit(10);
      return (data ?? []) as {
        id: string;
        date: string;
        description: string;
        amount: number;
      }[];
    },
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Tableau de bord</h1>
        <MonthNav
          year={year}
          month={month}
          onChange={(y, m) => {
            setYear(y);
            setMonth(m);
          }}
        />
      </div>
      <KpiCards
        totalIncome={totals.total_income}
        totalExpense={totals.total_expense}
        net={totals.net}
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <CategoryChart data={categoryData} />
        <RecentTransactions transactions={recent} />
      </div>
    </div>
  );
}
