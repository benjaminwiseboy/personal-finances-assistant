"use server";

import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { getUserId } from "@/lib/session";
import { BudgetFormSchema, type BudgetFormInput } from "@/domain/validators";

function revalidate() {
  revalidatePath("/budgets");
  revalidatePath("/dashboard");
}

/** A budget may only target the user's own root expense category. */
async function assertBudgetableCategory(
  categoryId: string,
  userId: string,
): Promise<{ error?: string }> {
  const [category] = await sql`
    select type, parent_id from categories
    where id = ${categoryId} and user_id = ${userId}`;

  if (!category) return { error: "Catégorie introuvable" };
  if (category.type !== "expense") {
    return { error: "Un budget ne porte que sur une catégorie de dépense" };
  }
  if (category.parent_id !== null) {
    return { error: "Choisissez une catégorie principale (pas une sous-catégorie)" };
  }
  return {};
}

export async function createBudget(
  input: BudgetFormInput,
): Promise<{ error?: string }> {
  const parsed = BudgetFormSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide" };
  }

  const userId = await getUserId();
  if (!userId) return { error: "Non authentifié" };

  try {
    const check = await assertBudgetableCategory(
      parsed.data.category_id,
      userId,
    );
    if (check.error) return check;

    await sql`
      insert into budgets (user_id, category_id, amount)
      values (${userId}, ${parsed.data.category_id}, ${parsed.data.amount})`;
  } catch (error) {
    // Unique violation → a budget already exists for this category.
    if ((error as { code?: string }).code === "23505") {
      return { error: "Cette catégorie a déjà un budget" };
    }
    return { error: "Échec de la création du budget" };
  }

  revalidate();
  return {};
}

export async function updateBudget(
  id: string,
  amount: string,
): Promise<{ error?: string }> {
  const parsed = BudgetFormSchema.shape.amount.safeParse(amount);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Montant invalide" };
  }

  const userId = await getUserId();
  if (!userId) return { error: "Non authentifié" };

  try {
    await sql`
      update budgets set amount = ${parsed.data}, updated_at = now()
      where id = ${id} and user_id = ${userId}`;
  } catch {
    return { error: "Échec de la mise à jour du budget" };
  }

  revalidate();
  return {};
}

export async function deleteBudget(id: string): Promise<{ error?: string }> {
  const userId = await getUserId();
  if (!userId) return { error: "Non authentifié" };

  try {
    await sql`delete from budgets where id = ${id} and user_id = ${userId}`;
  } catch {
    return { error: "Échec de la suppression du budget" };
  }

  revalidate();
  return {};
}
