"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { toast } from "sonner";
import {
  TransactionFormSchema,
  type TransactionFormInput,
} from "@/domain/validators";
import {
  createTransaction,
  updateTransaction,
} from "@/actions/transactions";
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

type Option = { id: string; name: string };

type TransactionFormProps = {
  accounts: Option[];
  categories: Option[];
  transaction?: {
    id: string;
    account_id: string;
    category_id: string;
    amount: number;
    date: string;
    description: string;
  };
  onSuccess?: () => void;
};

export function TransactionForm({
  accounts,
  categories,
  transaction,
  onSuccess,
}: TransactionFormProps) {
  const [submitting, setSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<TransactionFormInput>({
    resolver: zodResolver(TransactionFormSchema),
    defaultValues: transaction
      ? {
          account_id: transaction.account_id,
          category_id: transaction.category_id,
          amount: String(Math.abs(transaction.amount)),
          date: transaction.date,
          description: transaction.description,
        }
      : {
          account_id: accounts[0]?.id ?? "",
          category_id: categories[0]?.id ?? "",
          amount: "",
          date: new Date().toISOString().slice(0, 10),
          description: "",
        },
  });

  async function onSubmit(values: TransactionFormInput) {
    setSubmitting(true);
    const result = transaction
      ? await updateTransaction(transaction.id, values)
      : await createTransaction(values);
    setSubmitting(false);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    toast.success(transaction ? "Transaction mise à jour" : "Transaction créée");
    onSuccess?.();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="account_id">Compte</Label>
        <Select
          value={watch("account_id")}
          onValueChange={(v) => setValue("account_id", v as string)}
        >
          <SelectTrigger id="account_id">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {accounts.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="category_id">Catégorie</Label>
        <Select
          value={watch("category_id")}
          onValueChange={(v) => setValue("category_id", v as string)}
        >
          <SelectTrigger id="category_id">
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
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="amount">Montant</Label>
        <Input id="amount" {...register("amount")} />
        {errors.amount && (
          <p className="text-sm text-destructive">{errors.amount.message}</p>
        )}
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="date">Date</Label>
        <Input id="date" type="date" {...register("date")} />
        {errors.date && (
          <p className="text-sm text-destructive">{errors.date.message}</p>
        )}
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="description">Description</Label>
        <Input id="description" {...register("description")} />
        {errors.description && (
          <p className="text-sm text-destructive">{errors.description.message}</p>
        )}
      </div>
      <Button type="submit" disabled={submitting}>
        {submitting ? "Enregistrement..." : "Enregistrer"}
      </Button>
    </form>
  );
}
