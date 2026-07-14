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
import { TransferForm } from "@/components/transfers/transfer-form";
import { TransferList } from "@/components/transfers/transfer-list";

type Option = { id: string; name: string };

type TransferRow = {
  id: string;
  from_account_name: string;
  to_account_name: string;
  amount: number;
  date: string;
  description: string | null;
};

export default function TransfersPage() {
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

  const { data: transfers = [] } = useQuery({
    queryKey: ["transfers"],
    queryFn: async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("transfers")
        .select(
          "id, amount, date, description, from_account:accounts!transfers_from_account_id_fkey(name), to_account:accounts!transfers_to_account_id_fkey(name)",
        )
        .order("date", { ascending: false });

      return (data ?? []).map((row) => {
        const r = row as unknown as {
          id: string;
          amount: number;
          date: string;
          description: string | null;
          from_account: { name: string } | null;
          to_account: { name: string } | null;
        };
        return {
          id: r.id,
          amount: r.amount,
          date: r.date,
          description: r.description,
          from_account_name: r.from_account?.name ?? "",
          to_account_name: r.to_account?.name ?? "",
        } satisfies TransferRow;
      });
    },
  });

  function reload() {
    queryClient.invalidateQueries({ queryKey: ["transfers"] });
    queryClient.invalidateQueries({ queryKey: ["transactions"] });
    queryClient.invalidateQueries({ queryKey: ["accounts"] });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Transferts</h1>
        <Dialog open={creating} onOpenChange={setCreating}>
          <DialogTrigger render={<Button disabled={accounts.length < 2} />}>
            Nouveau transfert
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nouveau transfert</DialogTitle>
            </DialogHeader>
            <TransferForm
              accounts={accounts}
              onSuccess={() => {
                setCreating(false);
                reload();
              }}
            />
          </DialogContent>
        </Dialog>
      </div>
      <TransferList transfers={transfers} onChanged={reload} />
    </div>
  );
}
