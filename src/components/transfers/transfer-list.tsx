"use client";

import { toast } from "sonner";
import { formatMoney } from "@/lib/money";
import { deleteTransfer } from "@/actions/transfers";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type TransferRow = {
  id: string;
  from_account_name: string;
  to_account_name: string;
  amount: number;
  date: string;
  description: string | null;
};

export function TransferList({
  transfers,
  onChanged,
}: {
  transfers: TransferRow[];
  onChanged: () => void;
}) {
  async function handleDelete(id: string) {
    if (!confirm("Supprimer ce transfert ?")) return;
    const result = await deleteTransfer(id);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Transfert supprimé");
    onChanged();
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead>De</TableHead>
          <TableHead>Vers</TableHead>
          <TableHead>Description</TableHead>
          <TableHead className="text-right">Montant</TableHead>
          <TableHead />
        </TableRow>
      </TableHeader>
      <TableBody>
        {transfers.map((t) => (
          <TableRow key={t.id}>
            <TableCell>{t.date}</TableCell>
            <TableCell>{t.from_account_name}</TableCell>
            <TableCell>{t.to_account_name}</TableCell>
            <TableCell>{t.description ?? ""}</TableCell>
            <TableCell className="text-right">
              {formatMoney(t.amount)}
            </TableCell>
            <TableCell className="text-right">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDelete(t.id)}
              >
                Supprimer
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
