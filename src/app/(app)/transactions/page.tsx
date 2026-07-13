"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { TransactionForm } from "@/components/transactions/transaction-form";
import { TransactionList } from "@/components/transactions/transaction-list";

type Option = { id: string; name: string };

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

export default function TransactionsPage() {
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);

  const { data: accounts = [] } = useQuery({
    queryKey: ["accounts"],
    queryFn: async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("accounts")
        .select("id, name")
        .order("name");
      return (data ?? []) as Option[];
    },
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("categories")
        .select("id, name")
        .order("name");
      return (data ?? []) as Option[];
    },
  });

  const { data: transactions = [] } = useQuery({
    queryKey: ["transactions"],
    queryFn: async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("transactions")
        .select(
          "id, account_id, category_id, transfer_id, amount, date, description, accounts(name), categories(name)",
        )
        .order("date", { ascending: false });

      return (data ?? []).map((row) => {
        const r = row as unknown as {
          id: string;
          account_id: string;
          category_id: string | null;
          transfer_id: string | null;
          amount: number;
          date: string;
          description: string;
          accounts: { name: string } | null;
          categories: { name: string } | null;
        };
        return {
          id: r.id,
          account_id: r.account_id,
          account_name: r.accounts?.name ?? "",
          category_id: r.category_id,
          category_name: r.categories?.name ?? null,
          transfer_id: r.transfer_id,
          amount: r.amount,
          date: r.date,
          description: r.description,
        } satisfies TransactionRow;
      });
    },
  });

  function reload() {
    queryClient.invalidateQueries({ queryKey: ["transactions"] });
    queryClient.invalidateQueries({ queryKey: ["accounts"] });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Transactions</h1>
        <Dialog open={creating} onOpenChange={setCreating}>
          <DialogTrigger
            render={
              <Button disabled={accounts.length === 0 || categories.length === 0} />
            }
          >
            Nouvelle transaction
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nouvelle transaction</DialogTitle>
            </DialogHeader>
            <TransactionForm
              accounts={accounts}
              categories={categories}
              onSuccess={() => {
                setCreating(false);
                reload();
              }}
            />
          </DialogContent>
        </Dialog>
      </div>
      <TransactionList
        transactions={transactions}
        accounts={accounts}
        categories={categories}
        onChanged={reload}
      />
    </div>
  );
}
