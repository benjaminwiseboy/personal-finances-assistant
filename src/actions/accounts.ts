"use server";

import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { getUserId } from "@/lib/session";
import {
  AccountFormSchema,
  type AccountFormInput,
} from "@/domain/validators";

function revalidate() {
  revalidatePath("/accounts");
  revalidatePath("/dashboard");
}

export async function createAccount(
  input: AccountFormInput,
): Promise<{ error?: string }> {
  const parsed = AccountFormSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide" };
  }

  const userId = await getUserId();
  if (!userId) return { error: "Non authentifié" };

  try {
    await sql`
      insert into accounts (user_id, name, type, initial_balance)
      values (${userId}, ${parsed.data.name}, ${parsed.data.type},
              ${parsed.data.initial_balance})`;
  } catch {
    return { error: "Échec de la création du compte" };
  }

  revalidate();
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

  const userId = await getUserId();
  if (!userId) return { error: "Non authentifié" };

  try {
    await sql`
      update accounts
      set name = ${parsed.data.name}, type = ${parsed.data.type},
          initial_balance = ${parsed.data.initial_balance}
      where id = ${id} and user_id = ${userId}`;
  } catch {
    return { error: "Échec de la mise à jour du compte" };
  }

  revalidate();
  return {};
}

export async function setPrimaryAccount(
  id: string,
): Promise<{ error?: string }> {
  const userId = await getUserId();
  if (!userId) return { error: "Non authentifié" };

  try {
    // One transaction: clear the current primary first so the
    // one-primary-per-user index is happy, then set the new one.
    await sql.transaction([
      sql`update accounts set is_primary = false
          where user_id = ${userId} and is_primary`,
      sql`update accounts set is_primary = true
          where id = ${id} and user_id = ${userId}`,
    ]);
  } catch {
    return { error: "Échec de la mise à jour du compte principal" };
  }

  revalidate();
  return {};
}

export async function deleteAccount(
  id: string,
): Promise<{ error?: string }> {
  const userId = await getUserId();
  if (!userId) return { error: "Non authentifié" };

  try {
    const linked = await sql`
      select 1 from transactions
      where account_id = ${id} and user_id = ${userId}
      limit 1`;
    if (linked.length > 0) {
      return {
        error:
          "Impossible de supprimer ce compte : des transactions y sont rattachées",
      };
    }

    await sql`delete from accounts where id = ${id} and user_id = ${userId}`;
  } catch {
    return { error: "Échec de la suppression du compte" };
  }

  revalidate();
  return {};
}
