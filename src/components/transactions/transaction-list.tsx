"use client";

import { useState } from "react";
import { toast } from "sonner";
import { formatMoney } from "@/lib/money";
import { deleteTransaction } from "@/actions/transactions";
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
  amount: number;
  date: string;
  description: string;
};

type Option = { id: string; name: string };

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
    if (row.transfer_id) {
      toast.error(
        "Cette transaction fait partie d'un transfert : supprimez le transfert dans l'onglet Transferts",
      );
      return;
    }
    if (!confirm("Supprimer cette transaction ?")) return;
    const result = await deleteTransaction(row.id);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Transaction supprimée");
    onChanged();
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Compte</TableHead>
            <TableHead>Catégorie</TableHead>
            <TableHead className="text-right">Montant</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {transactions.map((tx) => (
            <TableRow key={tx.id}>
              <TableCell>{tx.date}</TableCell>
              <TableCell>{tx.description}</TableCell>
              <TableCell>{tx.account_name}</TableCell>
              <TableCell>{tx.category_name ?? "Transfert"}</TableCell>
              <TableCell
                className={`text-right ${tx.amount < 0 ? "text-red-600" : "text-emerald-600"}`}
              >
                {formatMoney(tx.amount)}
              </TableCell>
              <TableCell className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!!tx.transfer_id}
                  onClick={() => setEditing(tx)}
                >
                  Modifier
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDelete(tx)}
                >
                  Supprimer
                </Button>
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
    </>
  );
}
