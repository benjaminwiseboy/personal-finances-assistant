"use client";

import { useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Pencil, Plus, Trash2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  addHoldingMovement,
  deleteHolding,
  deleteHoldingMovement,
} from "@/actions/holdings";
import {
  KIND_LABELS,
  expectedGain,
  formatAmount,
  formatDue,
  formatPct,
  isOpen,
  isoDay,
  statusLabel,
  toEur,
} from "@/domain/holdings";
import { fetchData } from "@/lib/fetch-data";
import { formatMoney } from "@/lib/money";
import type { HoldingRow } from "@/server/queries";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { DueChip } from "./due-chip";
import { HoldingForm } from "./holding-form";

type Option = { id: string; name: string };

const SHORT_DATE = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "short",
  year: "2-digit",
  timeZone: "UTC",
});

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="font-mono text-[0.65rem] tracking-[0.14em] text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}

function MovementForm({
  holding,
  accounts,
  onDone,
}: {
  holding: HoldingRow;
  accounts: Option[];
  onDone: () => void;
}) {
  // After the opening movement, the usual next one goes the other way:
  // returns come in for an investment/loan, repayments go out for a debt.
  const [direction, setDirection] = useState<"in" | "out">(
    holding.kind === "debt" ? "out" : "in",
  );
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(isoDay(new Date()));
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const result = await addHoldingMovement({
      holding_id: holding.id,
      account_id: accountId,
      direction,
      amount,
      date,
      description: "",
    });
    setSubmitting(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Mouvement enregistré");
    onDone();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 rounded-xl bg-white/[0.03] p-3 ring-1 ring-white/10"
    >
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-white/[0.04] p-1 ring-1 ring-white/10">
        {(
          [
            ["in", "Entrée sur le compte", ArrowDownLeft],
            ["out", "Sortie du compte", ArrowUpRight],
          ] as const
        ).map(([value, label, Icon]) => (
          <button
            key={value}
            type="button"
            aria-pressed={direction === value}
            onClick={() => setDirection(value)}
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors",
              direction === value
                ? value === "in"
                  ? "bg-mint/12 text-mint ring-1 ring-mint/25"
                  : "bg-ember/12 text-ember ring-1 ring-ember/25"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="size-3.5" />
            {label}
          </button>
        ))}
      </div>
      <Select
        items={Object.fromEntries(accounts.map((a) => [a.id, a.name]))}
        value={accountId}
        onValueChange={(v) => setAccountId(v as string)}
      >
        <SelectTrigger className="w-full" aria-label="Compte">
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
      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="mv-amount" className="text-xs">
            Montant (€)
          </Label>
          <Input
            id="mv-amount"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="100,00"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">Date</Label>
          <DatePicker value={date} onChange={setDate} />
        </div>
      </div>
      <Button type="submit" size="sm" disabled={submitting || !accountId}>
        {submitting ? "Enregistrement…" : "Enregistrer le mouvement"}
      </Button>
    </form>
  );
}

/** Everything about one holding: facts, bank movements, edit, delete. */
export function HoldingDetail({
  holding,
  accounts,
  onChanged,
  onDeleted,
}: {
  holding: HoldingRow;
  accounts: Option[];
  onChanged: () => void;
  onDeleted: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);

  const { data: movements = [], refetch } = useQuery({
    queryKey: ["holding-movements", holding.id],
    queryFn: () => fetchData("holdingMovements", { holding: holding.id }),
  });

  if (editing) {
    return (
      <HoldingForm
        accounts={accounts}
        holding={holding}
        onSuccess={() => {
          setEditing(false);
          onChanged();
        }}
      />
    );
  }

  const gain = expectedGain(holding.amount, holding.expected_return_pct, holding.return_period);

  async function handleDelete() {
    const warning =
      holding.movement_count > 0
        ? `Supprimer « ${holding.name} » ? Ses ${holding.movement_count} mouvement(s) bancaires seront retirés et les soldes des comptes rétablis.`
        : `Supprimer « ${holding.name} » ?`;
    if (!confirm(warning)) return;
    const result = await deleteHolding(holding.id);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Supprimé");
    onDeleted();
  }

  async function handleDeleteMovement(id: string) {
    if (!confirm("Supprimer ce mouvement ? Le solde du compte sera rétabli.")) return;
    const result = await deleteHoldingMovement(id);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    await refetch();
    onChanged();
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">
          {KIND_LABELS[holding.kind]} · {statusLabel(holding.kind, holding.status)}
        </span>
        <span data-slot="figure" className="font-display text-3xl font-semibold tracking-tight">
          {formatAmount(holding.amount, holding.currency)}
        </span>
        {holding.currency === "XOF" && (
          <span data-slot="figure" className="text-sm text-muted-foreground">
            ≈ {formatMoney(toEur(holding.amount, "XOF"))}
          </span>
        )}
      </div>

      <dl className="grid grid-cols-2 gap-4">
        <Fact label={holding.kind === "debt" ? "Coût attendu" : "Rentabilité"}>
          {gain && holding.expected_return_pct !== null ? (
            <>
              {formatPct(holding.expected_return_pct)}
              {gain.perYear ? " / an" : ""}
              <span className="block text-xs text-muted-foreground" data-slot="figure">
                ≈ {formatAmount(gain.value, holding.currency)}
                {gain.perYear ? " par an" : ""}
              </span>
            </>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </Fact>
        <Fact label="Échéance">
          {holding.due_date ? (
            <span className="flex flex-col items-start gap-1">
              {formatDue(holding.due_date, holding.due_precision)}
              {isOpen(holding.status) && (
                <DueChip dueDate={holding.due_date} />
              )}
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </Fact>
      </dl>

      {holding.description && (
        <p className="text-sm whitespace-pre-line text-muted-foreground">{holding.description}</p>
      )}

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">Mouvements bancaires</h3>
          {!adding && accounts.length > 0 && (
            <Button variant="ghost" size="sm" onClick={() => setAdding(true)}>
              <Plus />
              Ajouter
            </Button>
          )}
        </div>
        {adding && (
          <MovementForm
            holding={holding}
            accounts={accounts}
            onDone={async () => {
              setAdding(false);
              await refetch();
              onChanged();
            }}
          />
        )}
        {movements.length === 0 && !adding ? (
          <p className="text-xs text-muted-foreground">
            Aucun mouvement lié à un compte. Ajoute les versements, remboursements ou revenus
            reçus pour que les soldes restent justes.
          </p>
        ) : (
          <ul className="flex flex-col">
            {movements.map((m) => (
              <li
                key={m.id}
                className="flex items-center gap-3 border-b border-white/[0.06] py-2 last:border-0"
              >
                <span className="w-16 shrink-0 font-mono text-xs text-muted-foreground">
                  {SHORT_DATE.format(new Date(`${m.date}T00:00:00Z`))}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm">{m.account_name}</span>
                <span
                  data-slot="figure"
                  className={cn("text-sm font-medium", m.amount >= 0 ? "text-mint" : "text-foreground")}
                >
                  {m.amount >= 0 ? "+" : ""}
                  {formatMoney(m.amount)}
                </span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Supprimer le mouvement"
                  className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => handleDeleteMovement(m.id)}
                >
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="flex gap-2 border-t border-white/[0.06] pt-4">
        <Button variant="outline" className="flex-1" onClick={() => setEditing(true)}>
          <Pencil />
          Modifier
        </Button>
        <Button
          variant="ghost"
          className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          onClick={handleDelete}
        >
          <Trash2 />
          Supprimer
        </Button>
      </div>
    </div>
  );
}
