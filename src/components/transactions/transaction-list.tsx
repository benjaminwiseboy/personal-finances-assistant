"use client";

import { useState } from "react";
import { ArrowRight, HandCoins, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatMoney } from "@/lib/money";
import { deleteTransaction } from "@/actions/transactions";
import { deleteTransfer } from "@/actions/transfers";
import { deleteHoldingMovement } from "@/actions/holdings";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TransactionForm } from "./transaction-form";

type TransactionRow = {
  id: string;
  account_id: string;
  account_name: string;
  category_id: string | null;
  category_name: string | null;
  transfer_id: string | null;
  holding_id: string | null;
  holding_name: string | null;
  amount: number;
  date: string;
  description: string;
};

type Option = { id: string; name: string };

const DAY_MONTH = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "short",
  year: "2-digit",
});

function formatDate(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : DAY_MONTH.format(parsed);
}

export function TransactionList({
  transactions,
  accounts,
  categories,
  onChanged,
}: {
  transactions: TransactionRow[];
  accounts: Option[];
  categories: Option[];
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState<TransactionRow | null>(null);

  async function handleDelete(row: TransactionRow) {
    if (row.holding_id) {
      if (!confirm(`Supprimer ce mouvement lié à « ${row.holding_name} » ?`)) return;
      const result = await deleteHoldingMovement(row.id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Mouvement supprimé");
      onChanged();
      return;
    }
    const isTransfer = !!row.transfer_id;
    if (
      !confirm(
        isTransfer
          ? "Supprimer ce transfert ? Les deux écritures liées seront retirées."
          : "Supprimer cette transaction ?",
      )
    ) {
      return;
    }
    const result = isTransfer
      ? await deleteTransfer(row.transfer_id!)
      : await deleteTransaction(row.id);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success(isTransfer ? "Transfert supprimé" : "Transaction supprimée");
    onChanged();
  }

  if (transactions.length === 0) {
    return (
      <div className="glass rounded-2xl bg-white/[0.03] px-6 py-14 text-center ring-1 ring-white/10">
        <p className="text-sm text-muted-foreground">
          Aucune opération pour cette sélection. Enregistres-en une ci-dessus ou
          change de mois.
        </p>
      </div>
    );
  }

  return (
    <div className="glass overflow-hidden rounded-2xl bg-white/[0.03] ring-1 ring-white/10">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="pl-4">Date</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Compte</TableHead>
            <TableHead>Catégorie</TableHead>
            <TableHead className="text-right">Montant</TableHead>
            <TableHead className="pr-4" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {transactions.map((tx) => (
            <TableRow key={tx.id}>
              <TableCell
                data-slot="figure"
                className="pl-4 font-mono text-xs whitespace-nowrap text-muted-foreground"
              >
                {formatDate(tx.date)}
              </TableCell>
              <TableCell className="max-w-56 truncate">
                {tx.description}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {tx.account_name}
              </TableCell>
              <TableCell>
                {tx.holding_id ? (
                  <span className="inline-flex max-w-44 items-center gap-1.5 rounded-full bg-mint/10 px-2 py-0.5 text-xs font-medium text-mint ring-1 ring-mint/20">
                    <HandCoins className="size-3 shrink-0" />
                    <span className="truncate">{tx.holding_name}</span>
                  </span>
                ) : tx.transfer_id ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-amber/10 px-2 py-0.5 text-xs font-medium text-amber ring-1 ring-amber/20">
                    <ArrowRight className="size-3" />
                    Transfert
                  </span>
                ) : (
                  <span className="text-muted-foreground">
                    {tx.category_name ?? "—"}
                  </span>
                )}
              </TableCell>
              <TableCell
                className={`text-right font-medium ${tx.amount < 0 ? "text-foreground" : "text-mint"}`}
                data-slot="figure"
              >
                {formatMoney(tx.amount)}
              </TableCell>
              <TableCell className="pr-4">
                <div className="flex justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Modifier"
                    disabled={!!tx.transfer_id || !!tx.holding_id}
                    onClick={() => setEditing(tx)}
                  >
                    <Pencil />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Supprimer"
                    className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => handleDelete(tx)}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier la transaction</DialogTitle>
          </DialogHeader>
          {editing && (
            <TransactionForm
              accounts={accounts}
              categories={categories}
              transaction={{
                id: editing.id,
                account_id: editing.account_id,
                category_id: editing.category_id ?? "",
                amount: editing.amount,
                date: editing.date,
                description: editing.description,
              }}
              onSuccess={() => {
                setEditing(null);
                onChanged();
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
