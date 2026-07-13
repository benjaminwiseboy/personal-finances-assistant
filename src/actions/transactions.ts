"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  TransactionFormSchema,
  type TransactionFormInput,
} from "@/domain/validators";
import { toDecimal } from "@/lib/money";

async function signedAmount(
  supabase: Awaited<ReturnType<typeof createClient>>,
  categoryId: string,
  amount: string,
): Promise<{ amount?: string; error?: string }> {
  const { data: category, error } = await supabase
    .from("categories")
    .select("type")
    .eq("id", categoryId)
    .single();

  if (error || !category) return { error: "Catégorie introuvable" };

  const magnitude = toDecimal(amount).abs();
  const signed =
    category.type === "expense" ? magnitude.negated() : magnitude;
  return { amount: signed.toString() };
}

export async function createTransaction(
  input: TransactionFormInput,
): Promise<{ error?: string }> {
  const parsed = TransactionFormSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Non authentifié" };

  const signed = await signedAmount(
    supabase,
    parsed.data.category_id,
    parsed.data.amount,
  );
  if (signed.error || !signed.amount) {
    return { error: signed.error ?? "Échec du calcul du montant" };
  }

  const { error } = await supabase.from("transactions").insert({
    user_id: user.id,
    account_id: parsed.data.account_id,
    category_id: parsed.data.category_id,
    amount: signed.amount,
    date: parsed.data.date,
    description: parsed.data.description,
  });

  if (error) return { error: "Échec de la création de la transaction" };

  revalidatePath("/transactions");
  revalidatePath("/accounts");
  revalidatePath("/dashboard");
  return {};
}

export async function updateTransaction(
  id: string,
  input: TransactionFormInput,
): Promise<{ error?: string }> {
  const parsed = TransactionFormSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Non authentifié" };

  const { data: existing, error: fetchError } = await supabase
    .from("transactions")
    .select("transfer_id")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (fetchError || !existing) return { error: "Transaction introuvable" };
  if (existing.transfer_id) {
    return {
      error:
        "Cette transaction fait partie d'un transfert : modifiez le transfert directement",
    };
  }

  const signed = await signedAmount(
    supabase,
    parsed.data.category_id,
    parsed.data.amount,
  );
  if (signed.error || !signed.amount) {
    return { error: signed.error ?? "Échec du calcul du montant" };
  }

  const { error } = await supabase
    .from("transactions")
    .update({
      account_id: parsed.data.account_id,
      category_id: parsed.data.category_id,
      amount: signed.amount,
      date: parsed.data.date,
      description: parsed.data.description,
    })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: "Échec de la mise à jour de la transaction" };

  revalidatePath("/transactions");
  revalidatePath("/accounts");
  revalidatePath("/dashboard");
  return {};
}

export async function deleteTransaction(
  id: string,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Non authentifié" };

  const { data: existing, error: fetchError } = await supabase
    .from("transactions")
    .select("transfer_id")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (fetchError || !existing) return { error: "Transaction introuvable" };
  if (existing.transfer_id) {
    return {
      error:
        "Cette transaction fait partie d'un transfert : supprimez le transfert directement",
    };
  }

  const { error } = await supabase
    .from("transactions")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return { error: "Échec de la suppression de la transaction" };

  revalidatePath("/transactions");
  revalidatePath("/accounts");
  revalidatePath("/dashboard");
  return {};
}
