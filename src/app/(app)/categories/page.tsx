"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
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
    queryKey: ["categories"],
    queryFn: async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("categories")
        .select("id, name, type, parent_id")
        .order("name");
      return (data ?? []) as CategoryRow[];
    },
  });

  function reload() {
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
