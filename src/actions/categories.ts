"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  CategoryFormSchema,
  type CategoryFormInput,
} from "@/domain/validators";

export async function createCategory(
  input: CategoryFormInput,
): Promise<{ error?: string }> {
  const parsed = CategoryFormSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Non authentifié" };

  if (parsed.data.parent_id) {
    const { data: parent } = await supabase
      .from("categories")
      .select("id, parent_id")
      .eq("id", parsed.data.parent_id)
      .eq("user_id", user.id)
      .single();
    if (!parent) return { error: "Catégorie parente introuvable" };
    if (parent.parent_id) {
      return { error: "La catégorie parente doit être une catégorie racine" };
    }
  }

  const { error } = await supabase.from("categories").insert({
    user_id: user.id,
    name: parsed.data.name,
    type: parsed.data.type,
    parent_id: parsed.data.parent_id,
  });

  if (error) return { error: "Échec de la création de la catégorie" };

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

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Non authentifié" };

  if (parsed.data.parent_id === id) {
    return {
      error: "Une catégorie ne peut pas être sa propre catégorie parente",
    };
  }

  if (parsed.data.parent_id) {
    const { data: parent } = await supabase
      .from("categories")
      .select("id, parent_id")
      .eq("id", parsed.data.parent_id)
      .eq("user_id", user.id)
      .single();
    if (!parent) return { error: "Catégorie parente introuvable" };
    if (parent.parent_id) {
      return { error: "La catégorie parente doit être une catégorie racine" };
    }

    const { data: children } = await supabase
      .from("categories")
      .select("id")
      .eq("parent_id", id)
      .limit(1);
    if (children && children.length > 0) {
      return {
        error:
          "Impossible de déplacer cette catégorie : elle a des sous-catégories",
      };
    }
  }

  const { error } = await supabase
    .from("categories")
    .update({
      name: parsed.data.name,
      type: parsed.data.type,
      parent_id: parsed.data.parent_id,
    })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: "Échec de la mise à jour de la catégorie" };

  revalidatePath("/categories");
  return {};
}

export async function deleteCategory(
  id: string,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Non authentifié" };

  const { data: linkedTx, error: txError } = await supabase
    .from("transactions")
    .select("id")
    .eq("category_id", id)
    .limit(1);

  if (txError) return { error: "Échec de la vérification de la catégorie" };
  if (linkedTx && linkedTx.length > 0) {
    return {
      error:
        "Impossible de supprimer cette catégorie : des transactions y sont rattachées",
    };
  }

  const { data: children, error: childError } = await supabase
    .from("categories")
    .select("id")
    .eq("parent_id", id)
    .limit(1);

  if (childError) return { error: "Échec de la vérification de la catégorie" };
  if (children && children.length > 0) {
    return {
      error:
        "Impossible de supprimer cette catégorie : elle a des sous-catégories",
    };
  }

  const { error } = await supabase
    .from("categories")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return { error: "Échec de la suppression de la catégorie" };

  revalidatePath("/categories");
  return {};
}
