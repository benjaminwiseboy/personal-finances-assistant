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

// Budget ----------------------------------------------------------------
// A recurring monthly spending limit on one expense category.

export const BudgetFormSchema = z.object({
  category_id: z.string().uuid("Catégorie requise"),
  amount: decimalString.refine(
    (v) => parseFloat(v) > 0,
    "Le montant doit être positif",
  ),
});
export type BudgetFormInput = z.input<typeof BudgetFormSchema>;
export type BudgetFormValues = z.output<typeof BudgetFormSchema>;

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

// Holding (placement, prêt accordé, dette) -----------------------------------

const optionalDecimal = z
  .string()
  .trim()
  .transform((v) => v.replace(/\s/g, "").replace(",", "."))
  .refine((v) => v === "" || /^[-+]?\d+(\.\d+)?$/.test(v), "Valeur invalide")
  .transform((v) => (v === "" ? null : v.replace(/^\+/, "")));

const optionalDate = z
  .string()
  .trim()
  .refine((v) => v === "" || !Number.isNaN(Date.parse(v)), "Date invalide")
  .transform((v) => (v === "" ? null : v));

export const HoldingFormSchema = z
  .object({
    kind: z.enum(["investment", "loan", "debt"]),
    name: z.string().trim().min(1, "Le nom est requis").max(120),
    description: emptyToNull.pipe(z.string().max(1000).nullable()),
    currency: z.enum(["EUR", "XOF"]),
    // Large FCFA amounts are typed with spaces: "3 000 000".
    amount: z
      .string()
      .trim()
      .transform((v) => v.replace(/\s/g, ""))
      .pipe(decimalString)
      .refine((v) => parseFloat(v) > 0, "Le montant doit être positif"),
    expected_return_pct: optionalDecimal,
    return_period: z.enum(["total", "annual"]),
    due_date: optionalDate,
    due_precision: z.enum(["day", "month", "year"]),
    status: z.enum(["planned", "sent", "active", "closed", "defaulted"]),
    // Creation only: the bank movement that funded (or received) it.
    account_id: emptyToNull,
    movement_amount: optionalDecimal,
    movement_date: optionalDate,
  })
  .refine(
    (d) => !d.account_id || (d.movement_amount && parseFloat(d.movement_amount) > 0),
    { message: "Indique le montant passé sur le compte", path: ["movement_amount"] },
  )
  .refine((d) => !d.account_id || d.movement_date, {
    message: "Indique la date du mouvement",
    path: ["movement_date"],
  });
export type HoldingFormInput = z.input<typeof HoldingFormSchema>;
export type HoldingFormValues = z.output<typeof HoldingFormSchema>;

// A movement on a bank account tied to a holding: money out of the account
// (investing, lending, repaying a debt) or into it (returns, repayment
// received, borrowed money). Always in euros, like the accounts.
export const HoldingMovementSchema = z.object({
  holding_id: z.string().uuid(),
  account_id: z.string().uuid("Compte requis"),
  direction: z.enum(["out", "in"]),
  amount: decimalString.refine(
    (v) => parseFloat(v) > 0,
    "Le montant doit être positif",
  ),
  date: z.string().date("Date requise"),
  description: emptyToNull.pipe(z.string().max(200).nullable()),
});
export type HoldingMovementInput = z.input<typeof HoldingMovementSchema>;
