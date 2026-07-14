"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  TransferFormSchema,
  type TransferFormInput,
} from "@/domain/validators";

export async function createTransfer(
  input: TransferFormInput,
): Promise<{ error?: string }> {
  const parsed = TransferFormSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide" };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_transfer", {
    p_from_account_id: parsed.data.from_account_id,
    p_to_account_id: parsed.data.to_account_id,
    p_amount: parsed.data.amount,
    p_date: parsed.data.date,
    p_description: parsed.data.description,
  });

  if (error) return { error: "Échec de la création du transfert" };

  revalidatePath("/transfers");
  revalidatePath("/transactions");
  revalidatePath("/accounts");
  revalidatePath("/dashboard");
  return {};
}

export async function deleteTransfer(
  id: string,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_transfer", {
    p_transfer_id: id,
  });

  if (error) return { error: "Échec de la suppression du transfert" };

  revalidatePath("/transfers");
  revalidatePath("/transactions");
  revalidatePath("/accounts");
  revalidatePath("/dashboard");
  return {};
}
