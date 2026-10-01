"use client";

import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { BudgetStatus } from "@/domain/budgets";
import { deleteBudget } from "@/actions/budgets";
import { formatMoney } from "@/lib/money";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BudgetBar } from "./budget-bar";
import { BudgetForm } from "./budget-form";

export type BudgetView = {
  id: string;
  category_id: string;
  category_name: string;
  status: BudgetStatus;
};

export function BudgetList({
  budgets,
  onChanged,
}: {
  budgets: BudgetView[];
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState<BudgetView | null>(null);

  async function handleDelete(b: BudgetView) {
    if (!confirm(`Supprimer le budget « ${b.category_name} » ?`)) return;
    const result = await deleteBudget(b.id);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Budget supprimé");
    onChanged();
  }

  if (budgets.length === 0) {
    return (
      <div className="glass rounded-2xl bg-white/[0.03] px-6 py-14 text-center ring-1 ring-white/10">
        <p className="font-display text-lg font-semibold">Aucun budget</p>
        <p className="mx-auto mt-1 max-w-xs text-sm text-muted-foreground">
          Fixe une limite mensuelle sur tes catégories de dépense pour suivre ta
          consommation.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {budgets.map((b) => {
        const { status } = b;
        const over = status.state === "over";
        return (
          <div
            key={b.id}
            className="glass group flex flex-col gap-4 rounded-2xl bg-white/[0.04] p-5 ring-1 ring-white/10"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 flex-col">
                <span className="truncate font-medium">{b.category_name}</span>
                <span className="font-mono text-[0.6875rem] tracking-wide text-muted-foreground uppercase">
                  Budget {formatMoney(status.amount)}
                </span>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Modifier"
                  onClick={() => setEditing(b)}
                >
                  <Pencil />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Supprimer"
                  className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => handleDelete(b)}
                >
                  <Trash2 />
                </Button>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between">
                <span
                  data-slot="figure"
                  className={`font-display text-xl font-semibold tracking-tight ${
                    over ? "text-destructive" : "text-foreground"
                  }`}
                >
                  {formatMoney(status.spent)}
                </span>
                <span className="font-mono text-xs text-muted-foreground">
                  {Math.round(status.rawRatio * 100)} %
                </span>
              </div>
              <BudgetBar ratio={status.ratio} state={status.state} />
              <p
                className={`text-sm ${
                  over ? "text-destructive" : "text-muted-foreground"
                }`}
              >
                {over
                  ? `Dépassé de ${formatMoney(-status.remaining)}`
                  : `${formatMoney(status.remaining)} restants`}
              </p>
            </div>
          </div>
        );
      })}

      <Dialog
        open={!!editing}
        onOpenChange={(open) => !open && setEditing(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier le budget</DialogTitle>
          </DialogHeader>
          {editing && (
            <BudgetForm
              budget={{
                id: editing.id,
                category_name: editing.category_name,
                amount: editing.status.amount,
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
