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
import { AccountForm } from "@/components/accounts/account-form";
import { AccountList } from "@/components/accounts/account-list";

type AccountRow = {
  account_id: string;
  name: string;
  type: string;
  initial_balance: number;
  balance: number;
};

export default function AccountsPage() {
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);

  const { data: accounts = [] } = useQuery({
    queryKey: ["accounts"],
    queryFn: async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("v_account_balances")
        .select("*")
        .order("name");
      return (data ?? []) as AccountRow[];
    },
  });

  function reload() {
    queryClient.invalidateQueries({ queryKey: ["accounts"] });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Comptes</h1>
        <Dialog open={creating} onOpenChange={setCreating}>
          <DialogTrigger render={<Button />}>Nouveau compte</DialogTrigger>
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
      <AccountList accounts={accounts} onChanged={reload} />
    </div>
  );
}
