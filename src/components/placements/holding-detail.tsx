"use client";

import { useState } from "react";
import { ArrowLeftRight, Pencil, Plus, Trash2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  addHoldingMovement,
  compensate,
  deleteHolding,
  deleteHoldingMovement,
} from "@/actions/holdings";
import {
  CURRENCY_LABELS,
  KIND_LABELS,
  expectedGain,
  formatAmount,
  formatDue,
  formatPct,
  fromEur,
  isOpen,
  isoDay,
  movementLabel,
  outstanding,
  statusLabel,
  toEur,
  type Currency,
  type MovementDirection,
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
import { RemainingBar } from "./remaining-bar";

type Option = { id: string; name: string };

const OFF_ACCOUNT = "none";

const SHORT_DATE = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "short",
  year: "2-digit",
  timeZone: "UTC",
});

const parseAmount = (v: string) => parseFloat(v.replace(/\s/g, "").replace(",", "."));

/** Prefill string for an amount in a currency (FCFA has no decimals). */
function prefill(n: number, currency: Currency): string {
  if (!Number.isFinite(n) || n <= 0) return "";
  return currency === "XOF" ? String(Math.round(n)) : n.toFixed(2);
}

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

function Panel({ children, onSubmit }: { children: React.ReactNode; onSubmit: (e: React.FormEvent) => void }) {
  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-col gap-3 rounded-xl bg-white/[0.03] p-3 ring-1 ring-white/10"
    >
      {children}
    </form>
  );
}

function MovementForm({
  holding,
  remaining,
  accounts,
  onDone,
  onCancel,
}: {
  holding: HoldingRow;
  remaining: number;
  accounts: Option[];
  onDone: () => void;
  onCancel: () => void;
}) {
  const [direction, setDirection] = useState<MovementDirection>("repayment");
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? OFF_ACCOUNT);
  const offAccount = accountId === OFF_ACCOUNT;
  const cur = holding.currency;

  // On an account the amount is in euros; hors compte, in the holding's currency.
  const [amount, setAmount] = useState(
    prefill(offAccount ? remaining : toEur(remaining, cur), offAccount ? cur : "EUR"),
  );
  const [ledgerTouched, setLedgerTouched] = useState(false);
  const [ledger, setLedger] = useState("");
  const [date, setDate] = useState(isoDay(new Date()));
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // FCFA counterpart of a euro bank movement, until edited by hand.
  const showLedger = !offAccount && cur === "XOF";
  const shownLedger = ledgerTouched ? ledger : prefill(fromEur(parseAmount(amount), "XOF"), "XOF");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const result = await addHoldingMovement({
      holding_id: holding.id,
      account_id: offAccount ? "" : accountId,
      direction,
      amount,
      holding_amount: showLedger ? shownLedger : "",
      date,
      note,
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
    <Panel onSubmit={handleSubmit}>
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-white/[0.04] p-1 ring-1 ring-white/10">
        {(["repayment", "funding"] as const).map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={direction === value}
            onClick={() => setDirection(value)}
            className={cn(
              "rounded-lg px-2 py-1.5 text-xs font-medium transition-colors",
              direction === value
                ? "bg-ember/15 text-foreground ring-1 ring-ember/30"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {movementLabel(holding.kind, value)}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label className="text-xs">Par</Label>
        <Select
          items={{ ...Object.fromEntries(accounts.map((a) => [a.id, a.name])), [OFF_ACCOUNT]: "Hors compte (espèces, en nature…)" }}
          value={accountId}
          onValueChange={(v) => {
            setAccountId(v as string);
            setAmount("");
          }}
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
            <SelectItem value={OFF_ACCOUNT}>Hors compte (espèces, en nature…)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="mv-amount" className="text-xs">
            Montant ({offAccount ? CURRENCY_LABELS[cur] : "€"})
          </Label>
          <Input
            id="mv-amount"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">Date</Label>
          <DatePicker value={date} onChange={setDate} />
        </div>
        {showLedger && (
          <div className="col-span-2 flex flex-col gap-1.5">
            <Label htmlFor="mv-ledger" className="text-xs">
              Compte pour (FCFA)
            </Label>
            <Input
              id="mv-ledger"
              inputMode="numeric"
              value={shownLedger}
              onChange={(e) => {
                setLedgerTouched(true);
                setLedger(e.target.value);
              }}
            />
          </div>
        )}
      </div>

      <Input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Note (optionnel)"
        aria-label="Note"
      />

      <p className="text-xs text-muted-foreground">
        {offAccount
          ? "Aucun solde bancaire ne bouge : seul le reste dû est mis à jour."
          : "Le solde du compte bouge, sans compter comme dépense ou entrée du mois."}
      </p>

      <div className="flex gap-2">
        <Button type="submit" size="sm" className="flex-1" disabled={submitting}>
          {submitting ? "Enregistrement…" : "Enregistrer"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          Annuler
        </Button>
      </div>
    </Panel>
  );
}

/**
 * The money owed to you on this loan/investment is paid by your debtor
 * straight to someone you owe: one repayment on each side, no bank account.
 */
function CompensationForm({
  holding,
  remaining,
  debts,
  onDone,
  onCancel,
}: {
  holding: HoldingRow;
  remaining: number;
  debts: (HoldingRow & { remaining: number })[];
  onDone: () => void;
  onCancel: () => void;
}) {
  const [debtId, setDebtId] = useState(debts[0]?.id ?? "");
  const debt = debts.find((d) => d.id === debtId);

  // Default: as much as both sides allow.
  const maxFrom = debt
    ? Math.min(remaining, fromEur(toEur(debt.remaining, debt.currency), holding.currency))
    : remaining;
  const [fromAmount, setFromAmount] = useState(prefill(maxFrom, holding.currency));
  const [toTouched, setToTouched] = useState(false);
  const [toAmount, setToAmount] = useState("");
  const [date, setDate] = useState(isoDay(new Date()));
  const [submitting, setSubmitting] = useState(false);

  const shownTo = toTouched
    ? toAmount
    : debt
      ? prefill(fromEur(toEur(parseAmount(fromAmount), holding.currency), debt.currency), debt.currency)
      : "";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const result = await compensate({
      from_holding_id: holding.id,
      to_holding_id: debtId,
      from_amount: fromAmount,
      to_amount: shownTo,
      date,
      note: "",
    });
    setSubmitting(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Compensation enregistrée");
    onDone();
  }

  return (
    <Panel onSubmit={handleSubmit}>
      <p className="text-xs text-muted-foreground">
        Ton débiteur rembourse directement ta dette : les deux restes dus baissent, aucun compte
        bancaire ne bouge.
      </p>
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs">Dette réglée</Label>
        <Select
          items={Object.fromEntries(debts.map((d) => [d.id, d.name]))}
          value={debtId}
          onValueChange={(v) => {
            setDebtId(v as string);
            setToTouched(false);
          }}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {debts.map((d) => (
              <SelectItem key={d.id} value={d.id}>
                {d.name} · reste {formatAmount(d.remaining, d.currency)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cp-from" className="text-xs">
            Reçu sur {holding.kind === "loan" ? "ce prêt" : "ce placement"} ({CURRENCY_LABELS[holding.currency]})
          </Label>
          <Input
            id="cp-from"
            inputMode="decimal"
            value={fromAmount}
            onChange={(e) => setFromAmount(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cp-to" className="text-xs">
            Déduit de la dette ({debt ? CURRENCY_LABELS[debt.currency] : "—"})
          </Label>
          <Input
            id="cp-to"
            inputMode="decimal"
            value={shownTo}
            onChange={(e) => {
              setToTouched(true);
              setToAmount(e.target.value);
            }}
          />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs">Date</Label>
        <DatePicker value={date} onChange={setDate} />
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="sm" className="flex-1" disabled={submitting || !debtId}>
          {submitting ? "Enregistrement…" : "Enregistrer la compensation"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          Annuler
        </Button>
      </div>
    </Panel>
  );
}

/** Everything about one holding: reste dû, ledger, edit, delete. */
export function HoldingDetail({
  holding,
  accounts,
  debts,
  onChanged,
  onDeleted,
}: {
  holding: HoldingRow;
  accounts: Option[];
  /** Open debts that a repayment on this holding could settle. */
  debts: (HoldingRow & { remaining: number })[];
  onChanged: () => void;
  onDeleted: () => void;
}) {
  const [mode, setMode] = useState<"view" | "edit" | "movement" | "compensation">("view");

  const { data: movements = [], refetch } = useQuery({
    queryKey: ["holding-movements", holding.id],
    queryFn: () => fetchData("holdingMovements", { holding: holding.id }),
  });

  if (mode === "edit") {
    return (
      <HoldingForm
        accounts={accounts}
        holding={holding}
        onSuccess={() => {
          setMode("view");
          onChanged();
        }}
      />
    );
  }

  const cur = holding.currency;
  const debt = holding.kind === "debt";
  const { remaining, surplus, ratio } = outstanding(holding.amount, holding.repaid, cur);
  const gain = expectedGain(holding.amount, holding.expected_return_pct, holding.return_period);
  const canCompensate = !debt && isOpen(holding.status) && remaining > 0 && debts.length > 0;

  async function refresh() {
    setMode("view");
    await refetch();
    onChanged();
  }

  async function handleDelete() {
    const warning =
      holding.movement_count > 0
        ? `Supprimer « ${holding.name} » ? Ses mouvements seront retirés : soldes des comptes rétablis, et les compensations annulées des deux côtés.`
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

  async function handleDeleteMovement(m: (typeof movements)[number]) {
    const warning = m.counterpart_name
      ? `Annuler cette compensation ? « ${m.counterpart_name} » sera aussi rétabli.`
      : m.account_name
        ? "Supprimer ce mouvement ? Le solde du compte sera rétabli."
        : "Supprimer ce mouvement ?";
    if (!confirm(warning)) return;
    const result = await deleteHoldingMovement(m.id);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    await refresh();
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">
            {KIND_LABELS[holding.kind]} · {statusLabel(holding.kind, holding.status)}
          </span>
          <span data-slot="figure" className="font-display text-3xl font-semibold tracking-tight">
            {formatAmount(remaining, cur)}
          </span>
          <span data-slot="figure" className="text-sm text-muted-foreground">
            {debt ? "restant à rembourser" : "restant dû"} sur {formatAmount(holding.amount, cur)}
            {cur === "XOF" && ` · ≈ ${formatMoney(toEur(remaining, "XOF"))}`}
          </span>
        </div>
        <RemainingBar ratio={ratio} debt={debt} />
        {surplus > 0 && (
          <span data-slot="figure" className={cn("text-sm", debt ? "text-ember" : "text-mint")}>
            {debt ? "Payé en plus du capital" : "Gain réalisé"} : {formatAmount(surplus, cur)}
          </span>
        )}
      </div>

      <dl className="grid grid-cols-2 gap-4">
        <Fact label={debt ? "Coût attendu" : "Rentabilité"}>
          {gain && holding.expected_return_pct !== null ? (
            <>
              {formatPct(holding.expected_return_pct)}
              {gain.perYear ? " / an" : ""}
              <span className="block text-xs text-muted-foreground" data-slot="figure">
                ≈ {formatAmount(gain.value, cur)}
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
              {isOpen(holding.status) && <DueChip dueDate={holding.due_date} />}
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
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-medium">Mouvements</h3>
          {mode === "view" && (
            <div className="flex gap-1">
              {canCompensate && (
                <Button variant="ghost" size="sm" onClick={() => setMode("compensation")}>
                  <ArrowLeftRight />
                  Régler une dette
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={() => setMode("movement")}>
                <Plus />
                Ajouter
              </Button>
            </div>
          )}
        </div>

        {mode === "movement" && (
          <MovementForm
            holding={holding}
            remaining={remaining}
            accounts={accounts}
            onDone={refresh}
            onCancel={() => setMode("view")}
          />
        )}
        {mode === "compensation" && (
          <CompensationForm
            holding={holding}
            remaining={remaining}
            debts={debts}
            onDone={refresh}
            onCancel={() => setMode("view")}
          />
        )}

        {movements.length === 0 && mode === "view" ? (
          <p className="text-xs text-muted-foreground">
            Aucun mouvement. Ajoute les remboursements au fil de l’eau : par un compte, hors
            compte, ou en réglant une de tes dettes.
          </p>
        ) : (
          <ul className="flex flex-col">
            {movements.map((m) => (
              <li
                key={m.id}
                className="flex items-center gap-3 border-b border-white/[0.06] py-2.5 last:border-0"
              >
                <span className="w-16 shrink-0 font-mono text-xs text-muted-foreground">
                  {SHORT_DATE.format(new Date(`${m.date}T00:00:00Z`))}
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm">{movementLabel(holding.kind, m.direction)}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {m.counterpart_name
                      ? `Compensation · ${m.counterpart_name}`
                      : m.account_name
                        ? `${m.account_name}${cur === "XOF" && m.bank_amount !== null ? ` · ${formatMoney(Math.abs(m.bank_amount))}` : ""}`
                        : (m.note ?? "Hors compte")}
                  </span>
                </span>
                <span
                  data-slot="figure"
                  className={cn(
                    "text-sm font-medium",
                    // Mint = money coming back to you.
                    m.direction === "repayment" && !debt ? "text-mint" : "text-foreground",
                  )}
                >
                  {formatAmount(m.amount, cur)}
                </span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Supprimer le mouvement"
                  className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => handleDeleteMovement(m)}
                >
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="flex gap-2 border-t border-white/[0.06] pt-4">
        <Button variant="outline" className="flex-1" onClick={() => setMode("edit")}>
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
