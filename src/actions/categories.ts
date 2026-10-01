"use server";

import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { getUserId } from "@/lib/session";
import {
  CategoryFormSchema,
  type CategoryFormInput,
} from "@/domain/validators";

/** The parent must be one of the user's root categories (max depth 2). */
async function checkParent(
  parentId: string,
  userId: string,
): Promise<{ error?: string }> {
  const [parent] = await sql`
    select id, parent_id from categories
    where id = ${parentId} and user_id = ${userId}`;
  if (!parent) return { error: "Catégorie parente introuvable" };
  if (parent.parent_id) {
    return { error: "La catégorie parente doit être une catégorie racine" };
  }
  return {};
}

export async function createCategory(
  input: CategoryFormInput,
): Promise<{ error?: string }> {
  const parsed = CategoryFormSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide" };
  }

  const userId = await getUserId();
  if (!userId) return { error: "Non authentifié" };

  try {
    if (parsed.data.parent_id) {
      const check = await checkParent(parsed.data.parent_id, userId);
      if (check.error) return check;
    }

    await sql`
      insert into categories (user_id, name, type, parent_id)
      values (${userId}, ${parsed.data.name}, ${parsed.data.type},
              ${parsed.data.parent_id})`;
  } catch {
    return { error: "Échec de la création de la catégorie" };
  }

  revalidatePath("/categories");
  return {};
}

export async function updateCategory(
  id: string,
  input: CategoryFormInput,
): Promise<{ error?: string }> {
  const parsed = CategoryFormSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide" };
  }

  const userId = await getUserId();
  if (!userId) return { error: "Non authentifié" };

  if (parsed.data.parent_id === id) {
    return {
      error: "Une catégorie ne peut pas être sa propre catégorie parente",
    };
  }

  try {
    if (parsed.data.parent_id) {
      const check = await checkParent(parsed.data.parent_id, userId);
      if (check.error) return check;

      const children = await sql`
        select 1 from categories
        where parent_id = ${id} and user_id = ${userId}
        limit 1`;
      if (children.length > 0) {
        return {
          error:
            "Impossible de déplacer cette catégorie : elle a des sous-catégories",
        };
      }
    }

    await sql`
      update categories
      set name = ${parsed.data.name}, type = ${parsed.data.type},
          parent_id = ${parsed.data.parent_id}
      where id = ${id} and user_id = ${userId}`;
  } catch {
    return { error: "Échec de la mise à jour de la catégorie" };
  }

  revalidatePath("/categories");
  return {};
}

export async function deleteCategory(
  id: string,
): Promise<{ error?: string }> {
  const userId = await getUserId();
  if (!userId) return { error: "Non authentifié" };

  try {
    const linkedTx = await sql`
      select 1 from transactions
      where category_id = ${id} and user_id = ${userId}
      limit 1`;
    if (linkedTx.length > 0) {
      return {
        error:
          "Impossible de supprimer cette catégorie : des transactions y sont rattachées",
      };
    }

    const children = await sql`
      select 1 from categories
      where parent_id = ${id} and user_id = ${userId}
      limit 1`;
    if (children.length > 0) {
      return {
        error:
          "Impossible de supprimer cette catégorie : elle a des sous-catégories",
      };
    }

    await sql`delete from categories where id = ${id} and user_id = ${userId}`;
  } catch {
    return { error: "Échec de la suppression de la catégorie" };
  }

  revalidatePath("/categories");
  return {};
}
