"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  TransactionFormSchema,
  TransferFormSchema,
} from "@/domain/validators";
import { createTransaction } from "@/actions/transactions";
import { createTransfer } from "@/actions/transfers";
import { formatMoney } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

type AccountOption = { id: string; name: string };
type CategoryOption = {
  id: string;
  name: string;
  type: "income" | "expense";
  parent_id: string | null;
};
type BudgetInfo = { amount: number; spent: number };

type OpType = "expense" | "income" | "transfer";

const TABS: { value: OpType; label: string; dot: string; active: string }[] = [
  {
    value: "expense",
    label: "Dépense",
    dot: "bg-ember",
    active: "bg-ember/15 text-foreground ring-ember/40",
  },
  {
    value: "income",
    label: "Entrée",
    dot: "bg-mint",
    active: "bg-mint/15 text-foreground ring-mint/40",
  },
  {
    value: "transfer",
    label: "Transfert",
    dot: "bg-amber",
    active: "bg-amber/15 text-foreground ring-amber/40",
  },
];

const today = () => new Date().toISOString().slice(0, 10);

/**
 * Spreadsheet-style entry row for the transactions page. Handles the three
 * operation types on one form; Enter commits and keeps the type/date/accounts
 * so the next operation can be typed straight away.
 */
export function QuickEntry({
  accounts,
  categories,
  budgetByRoot,
  defaultDate,
  defaultAccountId,
  onCreated,
}: {
  accounts: AccountOption[];
  categories: CategoryOption[];
  budgetByRoot?: Map<string, BudgetInfo>;
  defaultDate?: string;
  defaultAccountId?: string;
  onCreated: () => void;
}) {
  const [type, setType] = useState<OpType>("expense");
  const [date, setDate] = useState(defaultDate ?? today());
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState(
    defaultAccountId || accounts[0]?.id || "",
  );
  const [categoryId, setCategoryId] = useState("");
  const [fromId, setFromId] = useState(accounts[0]?.id ?? "");
  const [toId, setToId] = useState(accounts[1]?.id ?? accounts[0]?.id ?? "");
  const [submitting, setSubmitting] = useState(false);

  const isTransfer = type === "transfer";
  const typeCategories = categories.filter((c) => c.type === type);

  // Follow the page's month selector: new entries default into that month.
  useEffect(() => {
    if (defaultDate) setDate(defaultDate);
  }, [defaultDate]);

  // Follow the page's account filter: picking an account presets entry.
  useEffect(() => {
    if (defaultAccountId) setAccountId(defaultAccountId);
  }, [defaultAccountId]);

  // Keep the selected category valid for the current type.
  useEffect(() => {
    if (isTransfer) return;
    if (!typeCategories.some((c) => c.id === categoryId)) {
      setCategoryId(typeCategories[0]?.id ?? "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, categories]);

  // Keep account selections valid as accounts load in.
  useEffect(() => {
    if (accounts.length === 0) return;
    if (!accounts.some((a) => a.id === accountId)) {
      setAccountId(accounts[0].id);
    }
    if (!accounts.some((a) => a.id === fromId)) setFromId(accounts[0].id);
    if (!accounts.some((a) => a.id === toId)) {
      setToId(accounts[1]?.id ?? accounts[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accounts]);

  const noAccounts = accounts.length === 0;
  const notEnoughAccounts = isTransfer && accounts.length < 2;
  const noCategory = !isTransfer && typeCategories.length === 0;
  const blocked = noAccounts || notEnoughAccounts || noCategory;

  // Budget feedback for the selected expense category (mapped to its root).
  const selectedCategory = categories.find((c) => c.id === categoryId);
  const rootId = selectedCategory
    ? (selectedCategory.parent_id ?? selectedCategory.id)
    : null;
  const budget = type === "expense" && rootId ? budgetByRoot?.get(rootId) : undefined;
  const typedAmount = Number(amount.replace(",", "."));
  const budgetHint = budget
    ? (() => {
        const remainingBefore = budget.amount - budget.spent;
        const willSpend = Number.isFinite(typedAmount) && typedAmount > 0 ? typedAmount : 0;
        const remainingAfter = remainingBefore - willSpend;
        return {
          over: remainingAfter < 0,
          remainingBefore,
          remainingAfter,
        };
      })()
    : null;

  async function submit() {
    if (submitting || blocked) return;

    if (isTransfer) {
      const input = {
        from_account_id: fromId,
        to_account_id: toId,
        amount,
        date,
        description,
      };
      const parsed = TransferFormSchema.safeParse(input);
      if (!parsed.success) {
        toast.error(parsed.error.issues[0]?.message ?? "Transfert invalide");
        return;
      }
      setSubmitting(true);
      const result = await createTransfer(input);
      setSubmitting(false);
      if (result.error) return toast.error(result.error);
      toast.success("Transfert enregistré");
    } else {
      const input = {
        account_id: accountId,
        category_id: categoryId,
        amount,
        date,
        description,
      };
      const parsed = TransactionFormSchema.safeParse(input);
      if (!parsed.success) {
        toast.error(parsed.error.issues[0]?.message ?? "Opération invalide");
        return;
      }
      setSubmitting(true);
      const result = await createTransaction(input);
      setSubmitting(false);
      if (result.error) return toast.error(result.error);
      toast.success(type === "income" ? "Entrée enregistrée" : "Dépense enregistrée");
    }

    // Reset for the next entry, keeping the context that rarely changes.
    setAmount("");
    setDescription("");
    onCreated();
    document.getElementById("qe-description")?.focus();
  }

  const accountItems = Object.fromEntries(accounts.map((a) => [a.id, a.name]));
  const categoryItems = Object.fromEntries(
    typeCategories.map((c) => [c.id, c.name]),
  );

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="glass flex flex-col gap-4 rounded-2xl bg-white/[0.04] p-4 ring-1 ring-white/10"
    >
      {/* Type selector */}
      <div className="flex w-full max-w-md gap-1 rounded-xl bg-white/[0.04] p-1 ring-1 ring-white/10">
        {TABS.map((tab) => {
          const active = type === tab.value;
          return (
            <button
              key={tab.value}
              type="button"
              onClick={() => setType(tab.value)}
              aria-pressed={active}
              className={cn(
                "flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium ring-1 ring-transparent transition-colors focus-visible:ring-2 focus-visible:ring-ember/60 focus-visible:outline-none",
                active
                  ? tab.active
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <span className={cn("size-1.5 rounded-full", tab.dot)} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Fields — inline row on desktop, stacked on mobile */}
      <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-end">
        <Field label="Date" className="md:w-40">
          <DatePicker value={date} onChange={setDate} />
        </Field>

        <Field label="Description" className="md:min-w-48 md:flex-1">
          <Input
            id="qe-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={isTransfer ? "Motif (optionnel)" : "Ex. Courses"}
            autoFocus
          />
        </Field>

        {isTransfer ? (
          <>
            <Field label="Depuis" className="md:w-44">
              <AccountSelect
                items={accountItems}
                value={fromId}
                onChange={setFromId}
                accounts={accounts}
              />
            </Field>
            <div className="hidden shrink-0 pb-2.5 text-muted-foreground md:block">
              <ArrowRight className="size-4" />
            </div>
            <Field label="Vers" className="md:w-44">
              <AccountSelect
                items={accountItems}
                value={toId}
                onChange={setToId}
                accounts={accounts}
              />
            </Field>
          </>
        ) : (
          <>
            <Field label="Compte" className="md:w-44">
              <AccountSelect
                items={accountItems}
                value={accountId}
                onChange={setAccountId}
                accounts={accounts}
              />
            </Field>
            <Field label="Catégorie" className="md:w-44">
              <Select
                items={categoryItems}
                value={categoryId}
                onValueChange={(v) => setCategoryId(v as string)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {typeCategories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </>
        )}

        <Field label="Montant" className="md:w-32">
          <Input
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0,00"
          />
        </Field>

        <Button
          type="submit"
          disabled={submitting || blocked}
          className="md:h-10"
        >
          <Plus />
          Ajouter
        </Button>
      </div>

      {blocked && (
        <p className="text-sm text-muted-foreground">
          {noAccounts
            ? "Crée d’abord un compte pour enregistrer une opération."
            : notEnoughAccounts
              ? "Un transfert demande au moins deux comptes."
              : "Aucune catégorie de ce type — crées-en une dans l’onglet Catégories."}
        </p>
      )}

      {!blocked && budgetHint && (
        <p
          className={`flex items-center gap-2 text-sm ${
            budgetHint.over ? "text-destructive" : "text-muted-foreground"
          }`}
        >
          <span
            aria-hidden
            className={`size-1.5 rounded-full ${
              budgetHint.over ? "bg-destructive" : "bg-mint"
            }`}
          />
          {budgetHint.over
            ? `Dépasse le budget de ${formatMoney(-budgetHint.remainingAfter)}`
            : `Budget : il reste ${formatMoney(budgetHint.remainingBefore)} ce mois`}
        </p>
      )}
    </form>
  );
}

function Field({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={cn("flex flex-col gap-1.5", className)}>
      <span className="font-mono text-[0.625rem] font-medium tracking-[0.12em] text-muted-foreground uppercase">
        {label}
      </span>
      {children}
    </label>
  );
}

function AccountSelect({
  items,
  value,
  onChange,
  accounts,
}: {
  items: Record<string, string>;
  value: string;
  onChange: (v: string) => void;
  accounts: AccountOption[];
}) {
  return (
    <Select
      items={items}
      value={value}
      onValueChange={(v) => onChange(v as string)}
    >
      <SelectTrigger className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {accounts.map((a) => (
          <SelectItem key={a.id} value={a.id}>
            {a.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
