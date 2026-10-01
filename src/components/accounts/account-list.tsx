"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Coins,
  Landmark,
  Pencil,
  PiggyBank,
  Star,
  Trash2,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import {
  ACCOUNT_TYPE_LABELS,
  type AccountTypeInput,
} from "@/domain/validators";
import { formatMoney } from "@/lib/money";
import { deleteAccount, setPrimaryAccount } from "@/actions/accounts";
import { Button } from "@/components/ui/button";
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
  is_primary: boolean;
};

const TYPE_ICONS: Record<AccountTypeInput, LucideIcon> = {
  courant: Wallet,
  livret: PiggyBank,
  epargne: Landmark,
  autre: Coins,
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

  async function handleSetPrimary(account: AccountRow) {
    if (account.is_primary) return;
    const result = await setPrimaryAccount(account.account_id);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success(`« ${account.name} » est ton compte principal`);
    onChanged();
  }

  if (accounts.length === 0) {
    return (
      <div className="glass flex flex-col items-center gap-2 rounded-2xl bg-white/[0.03] px-6 py-16 text-center ring-1 ring-white/10">
        <span className="ember-tile mb-2 flex size-12 items-center justify-center rounded-2xl ring-1 ring-ember/25">
          <Wallet className="size-5 text-ember" />
        </span>
        <p className="font-display text-lg font-semibold">Aucun compte</p>
        <p className="max-w-xs text-sm text-muted-foreground">
          Créez votre premier compte pour commencer à suivre vos soldes.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {accounts.map((account) => {
        const Icon =
          TYPE_ICONS[account.type as AccountTypeInput] ?? Coins;
        const negative = account.balance < 0;
        return (
          <div
            key={account.account_id}
            className={`glass group relative flex flex-col gap-5 overflow-hidden rounded-2xl bg-white/[0.04] p-6 ring-1 transition-colors ${
              account.is_primary
                ? "ring-ember/40"
                : "ring-white/10 hover:ring-white/20"
            }`}
          >
            {/* Warm glow bleeding from the icon corner */}
            <div
              aria-hidden
              className={`pointer-events-none absolute -top-10 -left-10 size-28 rounded-full blur-2xl transition-opacity ${
                account.is_primary
                  ? "bg-ember/30"
                  : "bg-ember/15 group-hover:bg-ember/25"
              }`}
            />

            <div className="relative flex items-start justify-between gap-3">
              <span className="ember-tile flex size-12 items-center justify-center rounded-2xl shadow-lg shadow-ember/10 ring-1 ring-ember/25">
                <Icon className="size-5 text-ember" />
              </span>
              <div className="flex flex-col items-end gap-1.5">
                {account.is_primary && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-ember/15 px-2.5 py-1 font-mono text-[0.625rem] font-medium tracking-wide text-ember uppercase ring-1 ring-ember/30">
                    <Star className="size-3 fill-current" />
                    Principal
                  </span>
                )}
                <span className="rounded-full bg-white/[0.06] px-2.5 py-1 font-mono text-[0.625rem] font-medium tracking-wide text-muted-foreground uppercase ring-1 ring-white/10">
                  {ACCOUNT_TYPE_LABELS[account.type as AccountTypeInput] ??
                    account.type}
                </span>
              </div>
            </div>

            <div className="relative flex flex-col gap-1">
              <span className="truncate text-sm text-muted-foreground">
                {account.name}
              </span>
              <span
                data-slot="figure"
                className={`font-display text-2xl font-semibold tracking-tight ${
                  negative ? "text-ember" : "text-foreground"
                }`}
              >
                {formatMoney(account.balance)}
              </span>
            </div>

            <div className="relative mt-1 flex items-center gap-2 border-t border-white/[0.06] pt-4">
              <Dialog
                open={editing?.account_id === account.account_id}
                onOpenChange={(open) => setEditing(open ? account : null)}
              >
                <DialogTrigger
                  render={
                    <Button variant="outline" size="sm" className="flex-1" />
                  }
                >
                  <Pencil />
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
              {!account.is_primary && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Définir ${account.name} comme compte principal`}
                  title="Définir comme compte principal"
                  className="text-muted-foreground hover:bg-ember/10 hover:text-ember"
                  onClick={() => handleSetPrimary(account)}
                >
                  <Star />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Supprimer ${account.name}`}
                className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                onClick={() => handleDelete(account.account_id)}
              >
                <Trash2 />
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
