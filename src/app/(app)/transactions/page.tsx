"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchData } from "@/lib/fetch-data";
import { MonthNav } from "@/components/dashboard/month-nav";
import { QuickEntry } from "@/components/transactions/quick-entry";
import { TransactionList } from "@/components/transactions/transaction-list";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Option = { id: string; name: string };
type CategoryOption = {
  id: string;
  name: string;
  type: "income" | "expense";
  parent_id: string | null;
};

type TransactionRow = {
  id: string;
  account_id: string;
  account_name: string;
  category_id: string | null;
  category_name: string | null;
  transfer_id: string | null;
  amount: number;
  date: string;
  description: string;
};

const pad = (n: number) => String(n).padStart(2, "0");

export default function TransactionsPage() {
  const queryClient = useQueryClient();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [accountFilter, setAccountFilter] = useState<string>("all");

  const { data: accounts = [] } = useQuery({
    queryKey: ["accounts", "options"],
    queryFn: () => fetchData("accountOptions"),
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["categories", "options"],
    queryFn: () => fetchData("categories"),
  });

  // Budgets + this month's spending, to warn at entry time.
  const { data: budgets = [] } = useQuery({
    queryKey: ["budgets"],
    queryFn: () => fetchData("budgets"),
  });

  const { data: budgetSpending = [] } = useQuery({
    queryKey: ["budget-spending", year, month],
    queryFn: () => fetchData("monthExpensesByCategory", { year, month }),
  });

  // Keyed by root category id: its budget limit and spending so far this month.
  const budgetByRoot = useMemo(() => {
    const spent = new Map(
      budgetSpending.map((r) => [r.category_root_id, r.total]),
    );
    const map = new Map<string, { amount: number; spent: number }>();
    for (const b of budgets) {
      map.set(b.category_id, {
        amount: b.amount,
        spent: spent.get(b.category_id) ?? 0,
      });
    }
    return map;
  }, [budgets, budgetSpending]);

  const { data: transactions = [] } = useQuery({
    queryKey: ["transactions", year, month, accountFilter],
    queryFn: () =>
      fetchData("transactions", { year, month, account: accountFilter }),
  });

  // New entries land in the selected month: today if it is the current month,
  // otherwise the 1st, so switching months moves the entry date with you.
  const defaultDate = useMemo(() => {
    if (year === now.getFullYear() && month === now.getMonth() + 1) {
      return `${year}-${pad(month)}-${pad(now.getDate())}`;
    }
    return `${year}-${pad(month)}-01`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month]);

  const defaultAccountId =
    accountFilter === "all" ? (accounts[0]?.id ?? "") : accountFilter;

  function reload() {
    queryClient.invalidateQueries({ queryKey: ["transactions"] });
    queryClient.invalidateQueries({ queryKey: ["accounts"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard-balance"] });
    queryClient.invalidateQueries({ queryKey: ["net-worth-nets"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard-totals"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard-categories"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard-recent"] });
    queryClient.invalidateQueries({ queryKey: ["budget-spending"] });
    queryClient.invalidateQueries({ queryKey: ["category-analysis"] });
  }

  const accountFilterItems = {
    all: "Tous les comptes",
    ...Object.fromEntries(accounts.map((a) => [a.id, a.name])),
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          Transactions
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
          <Select
            items={accountFilterItems}
            value={accountFilter}
            onValueChange={(v) => setAccountFilter(v as string)}
          >
            <SelectTrigger aria-label="Filtrer par compte">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les comptes</SelectItem>
              {accounts.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <QuickEntry
        accounts={accounts}
        categories={categories}
        budgetByRoot={budgetByRoot}
        defaultDate={defaultDate}
        defaultAccountId={defaultAccountId}
        onCreated={reload}
      />
      <TransactionList
        transactions={transactions}
        accounts={accounts}
        categories={categories}
        onChanged={reload}
      />
    </div>
  );
}
