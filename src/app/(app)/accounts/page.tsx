"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { monthKey, netWorthSeries } from "@/domain/net-worth";
import { fetchData } from "@/lib/fetch-data";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AccountForm } from "@/components/accounts/account-form";
import { AccountList } from "@/components/accounts/account-list";
import { PatrimoineHero } from "@/components/accounts/patrimoine-hero";

type AccountRow = {
  account_id: string;
  name: string;
  type: string;
  initial_balance: number;
  balance: number;
  is_primary: boolean;
};

export default function AccountsPage() {
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);

  const { data: accounts = [] } = useQuery({
    // Namespaced sub-key: the transactions/transfers pickers use
    // ["accounts","options"] with a lighter {id,name} shape. Sharing a bare
    // ["accounts"] key served that shape here and formatMoney(balance) crashed.
    queryKey: ["accounts", "balances"],
    queryFn: () => fetchData("accountBalances"),
  });

  // Monthly net flow, to reconstruct net worth over time.
  const { data: monthlyNets = [] } = useQuery({
    queryKey: ["net-worth-nets"],
    queryFn: () => fetchData("monthlyNets"),
  });

  const total = useMemo(
    () => accounts.reduce((sum, a) => sum + (a.balance ?? 0), 0),
    [accounts],
  );

  const series = useMemo(() => {
    const netByMonth = new Map(
      monthlyNets.map((r) => [monthKey(r.year, r.month), r.net]),
    );
    const now = new Date();
    return netWorthSeries(
      total,
      netByMonth,
      { year: now.getFullYear(), month: now.getMonth() + 1 },
      12,
    ).map((p) => {
      const d = new Date(p.year, p.month - 1, 1);
      return {
        label: format(d, "MMM", { locale: fr }),
        sublabel: format(d, "MMMM yyyy", { locale: fr }),
        value: p.value,
      };
    });
  }, [total, monthlyNets]);

  function reload() {
    // Prefix match: refreshes both the balances view and the pickers.
    queryClient.invalidateQueries({ queryKey: ["accounts"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard-balance"] });
    queryClient.invalidateQueries({ queryKey: ["net-worth-nets"] });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          Comptes
        </h1>
        <Dialog open={creating} onOpenChange={setCreating}>
          <DialogTrigger render={<Button />}>
            <Plus />
            Nouveau compte
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nouveau compte</DialogTitle>
            </DialogHeader>
            <AccountForm
              onSuccess={() => {
                setCreating(false);
                reload();
              }}
            />
          </DialogContent>
        </Dialog>
      </div>
      {accounts.length > 0 && <PatrimoineHero total={total} series={series} />}
      <AccountList accounts={accounts} onChanged={reload} />
    </div>
  );
}
