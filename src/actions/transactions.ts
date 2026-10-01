"use server";

import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { getUserId } from "@/lib/session";
import {
  TransactionFormSchema,
  type TransactionFormInput,
} from "@/domain/validators";
import { toDecimal } from "@/lib/money";

function revalidate() {
  revalidatePath("/transactions");
  revalidatePath("/accounts");
  revalidatePath("/dashboard");
}

/**
 * Checks the account and category belong to the user, and signs the amount
 * from the category type (expense → negative).
 */
async function resolveTransaction(
  input: TransactionFormInput,
  userId: string,
): Promise<{ amount?: string; error?: string }> {
  const [account] = await sql`
    select id from accounts
    where id = ${input.account_id} and user_id = ${userId}`;
  if (!account) return { error: "Compte introuvable" };

  const [category] = await sql`
    select type from categories
    where id = ${input.category_id} and user_id = ${userId}`;
  if (!category) return { error: "Catégorie introuvable" };

  const magnitude = toDecimal(input.amount).abs();
  const signed =
    category.type === "expense" ? magnitude.negated() : magnitude;
  return { amount: signed.toString() };
}

/**
 * Transfer legs are only editable through the transfer itself, and holding
 * movements from the Placements page.
 */
async function checkEditable(
  id: string,
  userId: string,
  verb: "modifiez" | "supprimez",
): Promise<{ error?: string }> {
  const [existing] = await sql`
    select transfer_id, holding_id from transactions
    where id = ${id} and user_id = ${userId}`;
  if (!existing) return { error: "Transaction introuvable" };
  if (existing.holding_id) {
    return {
      error: `Ce mouvement est lié à un placement ou une dette : ${verb}-le depuis Placements`,
    };
  }
  if (existing.transfer_id) {
    return {
      error: `Cette transaction fait partie d'un transfert : ${verb} le transfert directement`,
    };
  }
  return {};
}

export async function createTransaction(
  input: TransactionFormInput,
): Promise<{ error?: string }> {
  const parsed = TransactionFormSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide" };
  }

  const userId = await getUserId();
  if (!userId) return { error: "Non authentifié" };

  try {
    const resolved = await resolveTransaction(parsed.data, userId);
    if (resolved.error || !resolved.amount) {
      return { error: resolved.error ?? "Échec du calcul du montant" };
    }

    await sql`
      insert into transactions
        (user_id, account_id, category_id, amount, date, description)
      values (${userId}, ${parsed.data.account_id}, ${parsed.data.category_id},
              ${resolved.amount}, ${parsed.data.date}, ${parsed.data.description})`;
  } catch {
    return { error: "Échec de la création de la transaction" };
  }

  revalidate();
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

  const userId = await getUserId();
  if (!userId) return { error: "Non authentifié" };

  try {
    const editable = await checkEditable(id, userId, "modifiez");
    if (editable.error) return editable;

    const resolved = await resolveTransaction(parsed.data, userId);
    if (resolved.error || !resolved.amount) {
      return { error: resolved.error ?? "Échec du calcul du montant" };
    }

    await sql`
      update transactions
      set account_id = ${parsed.data.account_id},
          category_id = ${parsed.data.category_id},
          amount = ${resolved.amount},
          date = ${parsed.data.date},
          description = ${parsed.data.description}
      where id = ${id} and user_id = ${userId}
        and transfer_id is null and holding_id is null`;
  } catch {
    return { error: "Échec de la mise à jour de la transaction" };
  }

  revalidate();
  return {};
}

export async function deleteTransaction(
  id: string,
): Promise<{ error?: string }> {
  const userId = await getUserId();
  if (!userId) return { error: "Non authentifié" };

  try {
    const editable = await checkEditable(id, userId, "supprimez");
    if (editable.error) return editable;

    await sql`
      delete from transactions
      where id = ${id} and user_id = ${userId}
        and transfer_id is null and holding_id is null`;
  } catch {
    return { error: "Échec de la suppression de la transaction" };
  }

  revalidate();
  return {};
}
