"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  AccountFormSchema,
  type AccountFormInput,
} from "@/domain/validators";

export async function createAccount(
  input: AccountFormInput,
): Promise<{ error?: string }> {
  const parsed = AccountFormSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Non authentifié" };

  const { error } = await supabase.from("accounts").insert({
    user_id: user.id,
    name: parsed.data.name,
    type: parsed.data.type,
    initial_balance: parsed.data.initial_balance,
  });

  if (error) return { error: "Échec de la création du compte" };

  revalidatePath("/accounts");
  revalidatePath("/dashboard");
  return {};
}

export async function updateAccount(
  id: string,
  input: AccountFormInput,
): Promise<{ error?: string }> {
  const parsed = AccountFormSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Non authentifié" };

  const { error } = await supabase
    .from("accounts")
    .update({
      name: parsed.data.name,
      type: parsed.data.type,
      initial_balance: parsed.data.initial_balance,
    })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: "Échec de la mise à jour du compte" };

  revalidatePath("/accounts");
  revalidatePath("/dashboard");
  return {};
}

export async function deleteAccount(
  id: string,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Non authentifié" };

  const { data: linked, error: linkedError } = await supabase
    .from("transactions")
    .select("id")
    .eq("account_id", id)
    .limit(1);

  if (linkedError) return { error: "Échec de la vérification du compte" };
  if (linked && linked.length > 0) {
    return {
      error:
        "Impossible de supprimer ce compte : des transactions y sont rattachées",
    };
  }

  const { error } = await supabase
    .from("accounts")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return { error: "Échec de la suppression du compte" };

  revalidatePath("/accounts");
  revalidatePath("/dashboard");
  return {};
}
