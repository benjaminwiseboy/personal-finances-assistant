"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchData } from "@/lib/fetch-data";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CategoryForm } from "@/components/categories/category-form";
import { CategoryTree } from "@/components/categories/category-tree";

type CategoryRow = {
  id: string;
  name: string;
  type: string;
  parent_id: string | null;
};

export default function CategoriesPage() {
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);

  const { data: categories = [] } = useQuery({
    // Namespaced sub-key: the transactions picker uses ["categories","options"]
    // with a lighter {id,name} shape. Sharing a bare ["categories"] key served
    // that shape here and the tree (which groups by type/parent) rendered empty.
    queryKey: ["categories", "tree"],
    queryFn: () => fetchData("categories"),
  });

  function reload() {
    // Prefix match: invalidates both ["categories","tree"] and the picker.
    queryClient.invalidateQueries({ queryKey: ["categories"] });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Catégories</h1>
        <Dialog open={creating} onOpenChange={setCreating}>
          <DialogTrigger render={<Button />}>Nouvelle catégorie</DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nouvelle catégorie</DialogTitle>
            </DialogHeader>
            <CategoryForm
              rootCategories={categories.filter((c) => c.parent_id === null)}
              onSuccess={() => {
                setCreating(false);
                reload();
              }}
            />
          </DialogContent>
        </Dialog>
      </div>
      <CategoryTree categories={categories} onChanged={reload} />
    </div>
  );
}
