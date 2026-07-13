"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { toast } from "sonner";
import {
  ACCOUNT_TYPE_LABELS,
  AccountFormSchema,
  type AccountFormInput,
} from "@/domain/validators";
import { createAccount, updateAccount } from "@/actions/accounts";
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

type AccountFormProps = {
  account?: { id: string; name: string; type: string; initial_balance: number };
  onSuccess?: () => void;
};

export function AccountForm({ account, onSuccess }: AccountFormProps) {
  const [submitting, setSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<AccountFormInput>({
    resolver: zodResolver(AccountFormSchema),
    defaultValues: account
      ? {
          name: account.name,
          type: account.type as AccountFormInput["type"],
          initial_balance: String(account.initial_balance),
        }
      : { name: "", type: "courant", initial_balance: "0" },
  });

  async function onSubmit(values: AccountFormInput) {
    setSubmitting(true);
    const result = account
      ? await updateAccount(account.id, values)
      : await createAccount(values);
    setSubmitting(false);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    toast.success(account ? "Compte mis à jour" : "Compte créé");
    onSuccess?.();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="name">Nom</Label>
        <Input id="name" {...register("name")} />
        {errors.name && (
          <p className="text-sm text-red-600">{errors.name.message}</p>
        )}
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="type">Type</Label>
        <Select
          value={watch("type")}
          onValueChange={(v) =>
            setValue("type", v as AccountFormInput["type"])
          }
        >
          <SelectTrigger id="type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(ACCOUNT_TYPE_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="initial_balance">Solde initial</Label>
        <Input id="initial_balance" {...register("initial_balance")} />
        {errors.initial_balance && (
          <p className="text-sm text-red-600">
            {errors.initial_balance.message}
          </p>
        )}
      </div>
      <Button type="submit" disabled={submitting}>
        {submitting ? "Enregistrement..." : "Enregistrer"}
      </Button>
    </form>
  );
}
