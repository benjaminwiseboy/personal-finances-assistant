"use server";

import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { getUserId } from "@/lib/session";
import {
  TransferFormSchema,
  type TransferFormInput,
} from "@/domain/validators";

function revalidate() {
  revalidatePath("/transactions");
  revalidatePath("/accounts");
  revalidatePath("/dashboard");
}

export async function createTransfer(
  input: TransferFormInput,
): Promise<{ error?: string }> {
  const parsed = TransferFormSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide" };
  }

  const userId = await getUserId();
  if (!userId) return { error: "Non authentifié" };

  try {
    await sql`
      select create_transfer(
        ${userId}, ${parsed.data.from_account_id}, ${parsed.data.to_account_id},
        ${parsed.data.amount}, ${parsed.data.date}, ${parsed.data.description}
      )`;
  } catch {
    return { error: "Échec de la création du transfert" };
  }

  revalidate();
  return {};
}

export async function deleteTransfer(
  id: string,
): Promise<{ error?: string }> {
  const userId = await getUserId();
  if (!userId) return { error: "Non authentifié" };

  try {
    await sql`select delete_transfer(${userId}, ${id})`;
  } catch {
    return { error: "Échec de la suppression du transfert" };
  }

  revalidate();
  return {};
}
