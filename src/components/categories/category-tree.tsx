"use client";

import { useState } from "react";
import { toast } from "sonner";
import { CATEGORY_TYPE_LABELS } from "@/domain/validators";
import { deleteCategory } from "@/actions/categories";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CategoryForm } from "./category-form";

type CategoryRow = {
  id: string;
  name: string;
  type: string;
  parent_id: string | null;
};

export function CategoryTree({
  categories,
  onChanged,
}: {
  categories: CategoryRow[];
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState<CategoryRow | null>(null);
  const roots = categories.filter((c) => c.parent_id === null);

  async function handleDelete(id: string) {
    if (!confirm("Supprimer cette catégorie ?")) return;
    const result = await deleteCategory(id);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Catégorie supprimée");
    onChanged();
  }

  return (
    <div className="flex flex-col gap-6">
      {(["income", "expense"] as const).map((type) => (
        <div key={type} className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-zinc-500">
            {CATEGORY_TYPE_LABELS[type]}
          </h2>
          {roots
            .filter((r) => r.type === type)
            .map((root) => (
              <div key={root.id} className="flex flex-col gap-1">
                <CategoryRowItem
                  category={root}
                  onEdit={() => setEditing(root)}
                  onDelete={() => handleDelete(root.id)}
                />
                {categories
                  .filter((c) => c.parent_id === root.id)
                  .map((child) => (
                    <div key={child.id} className="ml-6">
                      <CategoryRowItem
                        category={child}
                        onEdit={() => setEditing(child)}
                        onDelete={() => handleDelete(child.id)}
                      />
                    </div>
                  ))}
              </div>
            ))}
        </div>
      ))}

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier la catégorie</DialogTitle>
          </DialogHeader>
          {editing && (
            <CategoryForm
              rootCategories={roots}
              category={editing}
              onSuccess={() => {
                setEditing(null);
                onChanged();
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CategoryRowItem({
  category,
  onEdit,
  onDelete,
}: {
  category: CategoryRow;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-md border border-zinc-200 px-3 py-2 dark:border-zinc-800">
      <span>{category.name}</span>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={onEdit}>
          Modifier
        </Button>
        <Button variant="outline" size="sm" onClick={onDelete}>
          Supprimer
        </Button>
      </div>
    </div>
  );
}
