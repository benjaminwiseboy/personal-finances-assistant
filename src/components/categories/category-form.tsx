"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { toast } from "sonner";
import {
  CATEGORY_TYPE_LABELS,
  CategoryFormSchema,
  type CategoryFormInput,
} from "@/domain/validators";
import { createCategory, updateCategory } from "@/actions/categories";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type CategoryOption = { id: string; name: string; type: string };

type CategoryFormProps = {
  rootCategories: CategoryOption[];
  category?: { id: string; name: string; type: string; parent_id: string | null };
  onSuccess?: () => void;
};

export function CategoryForm({
  rootCategories,
  category,
  onSuccess,
}: CategoryFormProps) {
  const [submitting, setSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CategoryFormInput>({
    resolver: zodResolver(CategoryFormSchema),
    defaultValues: category
      ? {
          name: category.name,
          type: category.type as CategoryFormInput["type"],
          parent_id: category.parent_id ?? "",
        }
      : { name: "", type: "expense", parent_id: "" },
  });

  const selectedType = watch("type");
  const selectedParent = watch("parent_id");

  async function onSubmit(values: CategoryFormInput) {
    setSubmitting(true);
    const result = category
      ? await updateCategory(category.id, values)
      : await createCategory(values);
    setSubmitting(false);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    toast.success(category ? "Catégorie mise à jour" : "Catégorie créée");
    onSuccess?.();
  }

  const eligibleParents = rootCategories.filter(
    (c) => c.type === selectedType && c.id !== category?.id,
  );

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="name">Nom</Label>
        <Input id="name" {...register("name")} />
        {errors.name && (
          <p className="text-sm text-destructive">{errors.name.message}</p>
        )}
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="type">Type</Label>
        <Select
          items={CATEGORY_TYPE_LABELS}
          value={selectedType}
          onValueChange={(v) =>
            setValue("type", v as CategoryFormInput["type"])
          }
        >
          <SelectTrigger id="type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(CATEGORY_TYPE_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="parent_id">Catégorie parente (optionnel)</Label>
        <Select
          items={{
            none: "Aucune (catégorie racine)",
            ...Object.fromEntries(eligibleParents.map((c) => [c.id, c.name])),
          }}
          value={selectedParent || "none"}
          onValueChange={(v) => setValue("parent_id", v === "none" ? "" : v)}
        >
          <SelectTrigger id="parent_id">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Aucune (catégorie racine)</SelectItem>
            {eligibleParents.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button type="submit" disabled={submitting}>
        {submitting ? "Enregistrement..." : "Enregistrer"}
      </Button>
    </form>
  );
}
