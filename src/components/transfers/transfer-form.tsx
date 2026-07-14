"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { toast } from "sonner";
import {
  TransferFormSchema,
  type TransferFormInput,
} from "@/domain/validators";
import { createTransfer } from "@/actions/transfers";
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

export function TransferForm({
  accounts,
  onSuccess,
}: {
  accounts: Option[];
  onSuccess?: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<TransferFormInput>({
    resolver: zodResolver(TransferFormSchema),
    defaultValues: {
      from_account_id: accounts[0]?.id ?? "",
      to_account_id: accounts[1]?.id ?? "",
      amount: "",
      date: new Date().toISOString().slice(0, 10),
      description: "",
    },
  });

  async function onSubmit(values: TransferFormInput) {
    setSubmitting(true);
    const result = await createTransfer(values);
    setSubmitting(false);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    toast.success("Transfert effectué");
    onSuccess?.();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="from_account_id">Compte source</Label>
        <Select
          value={watch("from_account_id")}
          onValueChange={(v) => setValue("from_account_id", v as string)}
        >
          <SelectTrigger id="from_account_id">
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
        <Label htmlFor="to_account_id">Compte destination</Label>
        <Select
          value={watch("to_account_id")}
          onValueChange={(v) => setValue("to_account_id", v as string)}
        >
          <SelectTrigger id="to_account_id">
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
        {errors.to_account_id && (
          <p className="text-sm text-red-600">
            {errors.to_account_id.message}
          </p>
        )}
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="amount">Montant</Label>
        <Input id="amount" {...register("amount")} />
        {errors.amount && (
          <p className="text-sm text-red-600">{errors.amount.message}</p>
        )}
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="date">Date</Label>
        <Input id="date" type="date" {...register("date")} />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="description">Description (optionnel)</Label>
        <Input id="description" {...register("description")} />
      </div>
      <Button type="submit" disabled={submitting}>
        {submitting ? "Transfert en cours..." : "Transférer"}
      </Button>
    </form>
  );
}
