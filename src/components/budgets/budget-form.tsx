"use client";

import { useState } from "react";
import { toast } from "sonner";
import { createBudget, updateBudget } from "@/actions/budgets";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type CategoryOption = { id: string; name: string };

/**
 * Create a budget (pick a category + amount) or edit an existing one (amount
 * only — the category is fixed once budgeted).
 */
export function BudgetForm({
  availableCategories,
  budget,
  onSuccess,
}: {
  availableCategories?: CategoryOption[];
  budget?: { id: string; category_name: string; amount: number };
  onSuccess: () => void;
}) {
  const isEdit = !!budget;
  const categories = availableCategories ?? [];
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [amount, setAmount] = useState(
    budget ? String(budget.amount) : "",
  );
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const result = isEdit
      ? await updateBudget(budget.id, amount)
      : await createBudget({ category_id: categoryId, amount });
    setSubmitting(false);

    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success(isEdit ? "Budget mis à jour" : "Budget créé");
    onSuccess();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label>Catégorie</Label>
        {isEdit ? (
          <p className="rounded-lg bg-white/[0.04] px-3 py-2.5 text-sm ring-1 ring-white/10">
            {budget.category_name}
          </p>
        ) : (
          <Select
            items={Object.fromEntries(categories.map((c) => [c.id, c.name]))}
            value={categoryId}
            onValueChange={(v) => setCategoryId(v as string)}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="budget-amount">Limite mensuelle (€)</Label>
        <Input
          id="budget-amount"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="400,00"
          autoFocus
        />
      </div>
      <Button
        type="submit"
        disabled={submitting || (!isEdit && !categoryId)}
      >
        {submitting
          ? "Enregistrement…"
          : isEdit
            ? "Enregistrer"
            : "Créer le budget"}
      </Button>
    </form>
  );
}
