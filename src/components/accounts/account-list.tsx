"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ACCOUNT_TYPE_LABELS } from "@/domain/validators";
import { formatMoney } from "@/lib/money";
import { deleteAccount } from "@/actions/accounts";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { AccountForm } from "./account-form";

type AccountRow = {
  account_id: string;
  name: string;
  type: string;
  initial_balance: number;
  balance: number;
};

export function AccountList({
  accounts,
  onChanged,
}: {
  accounts: AccountRow[];
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState<AccountRow | null>(null);

  async function handleDelete(id: string) {
    if (!confirm("Supprimer ce compte ?")) return;
    const result = await deleteAccount(id);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Compte supprimé");
    onChanged();
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {accounts.map((account) => (
        <Card key={account.account_id}>
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-base">
              <span>{account.name}</span>
              <span className="text-xs font-normal text-zinc-500">
                {ACCOUNT_TYPE_LABELS[
                  account.type as keyof typeof ACCOUNT_TYPE_LABELS
                ] ?? account.type}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <span className="text-lg font-semibold">
              {formatMoney(account.balance)}
            </span>
            <div className="flex gap-2">
              <Dialog
                open={editing?.account_id === account.account_id}
                onOpenChange={(open) => setEditing(open ? account : null)}
              >
                <DialogTrigger render={<Button variant="outline" size="sm" />}>
                  Modifier
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Modifier le compte</DialogTitle>
                  </DialogHeader>
                  <AccountForm
                    account={{
                      id: account.account_id,
                      name: account.name,
                      type: account.type,
                      initial_balance: account.initial_balance,
                    }}
                    onSuccess={() => {
                      setEditing(null);
                      onChanged();
                    }}
                  />
                </DialogContent>
              </Dialog>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDelete(account.account_id)}
              >
                Supprimer
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
