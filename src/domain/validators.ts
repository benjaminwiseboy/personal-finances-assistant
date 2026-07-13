import { z } from "zod";

// Shared primitives ----------------------------------------------------------

const emptyToNull = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .nullable();

const decimalString = z
  .string()
  .trim()
  .regex(/^-?\d+([.,]\d+)?$/, "Montant invalide")
  .transform((v) => v.replace(",", "."));

// Account ----------------------------------------------------------------

export const AccountTypeSchema = z.enum([
  "courant",
  "livret",
  "epargne",
  "autre",
]);
export type AccountTypeInput = z.infer<typeof AccountTypeSchema>;

export const ACCOUNT_TYPE_LABELS: Record<AccountTypeInput, string> = {
  courant: "Compte courant",
  livret: "Livret",
  epargne: "Épargne",
  autre: "Autre",
};

export const AccountFormSchema = z.object({
  name: z.string().trim().min(1, "Le nom est requis").max(80),
  type: AccountTypeSchema,
  initial_balance: decimalString,
});
export type AccountFormInput = z.input<typeof AccountFormSchema>;
export type AccountFormValues = z.output<typeof AccountFormSchema>;

// Category ----------------------------------------------------------------

export const CategoryTypeSchema = z.enum(["income", "expense"]);
export type CategoryTypeInput = z.infer<typeof CategoryTypeSchema>;

export const CATEGORY_TYPE_LABELS: Record<CategoryTypeInput, string> = {
  income: "Entrée",
  expense: "Sortie",
};

export const CategoryFormSchema = z.object({
  name: z.string().trim().min(1, "Le nom est requis").max(80),
  type: CategoryTypeSchema,
  parent_id: emptyToNull,
});
export type CategoryFormInput = z.input<typeof CategoryFormSchema>;
export type CategoryFormValues = z.output<typeof CategoryFormSchema>;

// Transaction ----------------------------------------------------------------
// The amount entered here is always zero or positive (zero is allowed, e.g.
// for a balance adjustment/régularisation): the sign (credit/debit) is
// derived server-side from the selected category's type (income → positive,
// expense → negative) so the user never has to think about signs.

export const TransactionFormSchema = z.object({
  account_id: z.string().uuid("Compte requis"),
  category_id: z.string().uuid("Catégorie requise"),
  amount: decimalString.refine(
    (v) => parseFloat(v) >= 0,
    "Le montant ne peut pas être négatif",
  ),
  date: z.string().date("Date requise"),
  description: z
    .string()
    .trim()
    .min(1, "La description est requise")
    .max(200),
});
export type TransactionFormInput = z.input<typeof TransactionFormSchema>;
export type TransactionFormValues = z.output<typeof TransactionFormSchema>;

// Transfer ----------------------------------------------------------------

export const TransferFormSchema = z
  .object({
    from_account_id: z.string().uuid("Compte source requis"),
    to_account_id: z.string().uuid("Compte destination requis"),
    amount: decimalString.refine(
      (v) => parseFloat(v) > 0,
      "Le montant doit être positif",
    ),
    date: z.string().date("Date requise"),
    description: emptyToNull,
  })
  .refine((data) => data.from_account_id !== data.to_account_id, {
    message: "Les comptes source et destination doivent être différents",
    path: ["to_account_id"],
  });
export type TransferFormInput = z.input<typeof TransferFormSchema>;
export type TransferFormValues = z.output<typeof TransferFormSchema>;
