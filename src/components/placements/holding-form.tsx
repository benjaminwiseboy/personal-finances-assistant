"use client";

import { useState } from "react";
import { toast } from "sonner";
import { createHolding, updateHolding } from "@/actions/holdings";
import {
  CURRENCY_LABELS,
  KIND_LABELS,
  STATUSES,
  XOF_PER_EUR,
  isoDay,
  statusLabel,
  type Currency,
  type DuePrecision,
  type HoldingKind,
  type HoldingStatus,
  type ReturnPeriod,
} from "@/domain/holdings";
import type { HoldingRow } from "@/server/queries";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

type Option = { id: string; name: string };

const NO_ACCOUNT = "none";

const PRECISION_LABELS: Record<DuePrecision, string> = {
  day: "Date précise",
  month: "Mois",
  year: "Année",
};

/** Two-to-three way toggle, styled like the quick-entry type switch. */
function Segmented<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  ariaLabel: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="grid auto-cols-fr grid-flow-col gap-1 rounded-xl bg-white/[0.04] p-1 ring-1 ring-white/10"
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-lg px-2 py-1.5 text-sm font-medium transition-colors",
            "focus-visible:ring-2 focus-visible:ring-ember/60 focus-visible:outline-none",
            value === o.value
              ? "bg-ember/15 text-foreground ring-1 ring-ember/30"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** What the due-date input shows for a stored ISO date at a precision. */
function dueInputValue(iso: string | null, precision: DuePrecision): string {
  if (!iso) return "";
  if (precision === "year") return iso.slice(0, 4);
  if (precision === "month") return iso.slice(0, 7);
  return iso;
}

/** Back to an ISO date the server normalises (end of month / year). */
function dueInputToIso(value: string, precision: DuePrecision): string {
  if (!value) return "";
  if (precision === "year") return /^\d{4}$/.test(value) ? `${value}-01-01` : "";
  if (precision === "month") return /^\d{4}-\d{2}$/.test(value) ? `${value}-01` : "";
  return value;
}

function eurHint(amount: string, currency: Currency): string {
  const n = parseFloat(amount.replace(/\s/g, "").replace(",", "."));
  if (!Number.isFinite(n) || n <= 0) return "";
  return currency === "XOF" ? (n / XOF_PER_EUR).toFixed(2) : n.toFixed(2);
}

/**
 * Create or edit a placement, loan or debt. At creation it can also record
 * the bank movement that funded it (or, for a debt, received the money).
 */
export function HoldingForm({
  accounts,
  holding,
  defaultKind = "investment",
  onSuccess,
}: {
  accounts: Option[];
  holding?: HoldingRow;
  defaultKind?: HoldingKind;
  onSuccess: () => void;
}) {
  const isEdit = !!holding;
  const [kind, setKind] = useState<HoldingKind>(holding?.kind ?? defaultKind);
  const [name, setName] = useState(holding?.name ?? "");
  const [description, setDescription] = useState(holding?.description ?? "");
  const [currency, setCurrency] = useState<Currency>(holding?.currency ?? "EUR");
  const [amount, setAmount] = useState(holding ? String(holding.amount) : "");
  const [pct, setPct] = useState(
    holding?.expected_return_pct != null ? String(holding.expected_return_pct) : "",
  );
  const [period, setPeriod] = useState<ReturnPeriod>(holding?.return_period ?? "total");
  const [precision, setPrecision] = useState<DuePrecision>(holding?.due_precision ?? "day");
  const [due, setDue] = useState(dueInputValue(holding?.due_date ?? null, holding?.due_precision ?? "day"));
  const [status, setStatus] = useState<HoldingStatus>(holding?.status ?? "active");

  const [accountId, setAccountId] = useState(NO_ACCOUNT);
  const [movementAmount, setMovementAmount] = useState("");
  const [movementTouched, setMovementTouched] = useState(false);
  const [movementDate, setMovementDate] = useState(isoDay(new Date()));
  const [submitting, setSubmitting] = useState(false);

  // Until edited by hand, the bank movement mirrors the amount (in euros).
  const shownMovement = movementTouched ? movementAmount : eurHint(amount, currency);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const linked = accountId !== NO_ACCOUNT;
    const input = {
      kind,
      name,
      description,
      currency,
      amount,
      expected_return_pct: pct,
      return_period: period,
      due_date: dueInputToIso(due, precision),
      due_precision: precision,
      status,
      account_id: linked ? accountId : "",
      movement_amount: linked ? shownMovement : "",
      movement_date: linked ? movementDate : "",
    };
    const result = isEdit ? await updateHolding(holding.id, input) : await createHolding(input);
    setSubmitting(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success(isEdit ? "Modifications enregistrées" : `${KIND_LABELS[kind]} ajouté${kind === "debt" ? "e" : ""}`);
    onSuccess();
  }

  const debt = kind === "debt";
  const accountItems = { [NO_ACCOUNT]: "Aucun", ...Object.fromEntries(accounts.map((a) => [a.id, a.name])) };
  const statusItems = Object.fromEntries(STATUSES.map((s) => [s, statusLabel(kind, s)]));

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Segmented
        ariaLabel="Type"
        value={kind}
        onChange={setKind}
        options={[
          { value: "investment", label: "Investissement" },
          { value: "loan", label: "Prêt" },
          { value: "debt", label: "Dette" },
        ]}
      />

      <div className="flex flex-col gap-2">
        <Label htmlFor="h-name">Nom</Label>
        <Input
          id="h-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={debt ? "Dette papa – terrain" : kind === "loan" ? "Prêt à l’ESIF" : "Investissement terrain"}
          autoFocus={!isEdit}
        />
      </div>

      <div className="grid grid-cols-[1fr_auto] gap-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="h-amount">{kind === "investment" ? "Montant investi" : "Montant"}</Label>
          <Input
            id="h-amount"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={currency === "XOF" ? "3 000 000" : "2 500"}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label>Devise</Label>
          <Segmented
            ariaLabel="Devise"
            value={currency}
            onChange={setCurrency}
            options={[
              { value: "EUR", label: CURRENCY_LABELS.EUR },
              { value: "XOF", label: CURRENCY_LABELS.XOF },
            ]}
          />
        </div>
      </div>

      <div className="grid grid-cols-[1fr_auto] gap-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="h-pct">
            {debt ? "Coût attendu (%)" : "Rentabilité attendue (%)"}{" "}
            <span className="font-normal text-muted-foreground">· optionnel</span>
          </Label>
          <Input
            id="h-pct"
            inputMode="decimal"
            value={pct}
            onChange={(e) => setPct(e.target.value)}
            placeholder="+10"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label>Sur</Label>
          <Segmented
            ariaLabel="Période de la rentabilité"
            value={period}
            onChange={setPeriod}
            options={[
              { value: "total", label: "Total" },
              { value: "annual", label: "Par an" },
            ]}
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label>
          Échéance <span className="font-normal text-muted-foreground">· optionnel</span>
        </Label>
        <div className="grid grid-cols-[auto_1fr] gap-2">
          <Select
            items={PRECISION_LABELS}
            value={precision}
            onValueChange={(v) => {
              setPrecision(v as DuePrecision);
              setDue("");
            }}
          >
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(PRECISION_LABELS) as DuePrecision[]).map((p) => (
                <SelectItem key={p} value={p}>
                  {PRECISION_LABELS[p]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {precision === "day" ? (
            <DatePicker value={due} onChange={setDue} />
          ) : precision === "month" ? (
            <Input type="month" value={due} onChange={(e) => setDue(e.target.value)} aria-label="Mois d’échéance" />
          ) : (
            <Input
              inputMode="numeric"
              maxLength={4}
              value={due}
              onChange={(e) => setDue(e.target.value.replace(/\D/g, ""))}
              placeholder="2030"
              aria-label="Année d’échéance"
            />
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label>Statut</Label>
        <Select items={statusItems} value={status} onValueChange={(v) => setStatus(v as HoldingStatus)}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {statusLabel(kind, s)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="h-desc">
          Description <span className="font-normal text-muted-foreground">· optionnel</span>
        </Label>
        <Textarea
          id="h-desc"
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={debt ? "Reste à compléter, je prendrai l’argent sur…" : "Comment l’argent travaille, conditions…"}
        />
      </div>

      {!isEdit && (
        <fieldset className="flex flex-col gap-3 rounded-xl bg-white/[0.03] p-3 ring-1 ring-white/10">
          <legend className="px-1 text-xs font-medium text-muted-foreground">
            {debt ? "Compte crédité" : "Compte débité"} · optionnel
          </legend>
          <Select items={accountItems} value={accountId} onValueChange={(v) => setAccountId(v as string)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_ACCOUNT}>Aucun</SelectItem>
              {accounts.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {accountId !== NO_ACCOUNT && (
            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="h-mv-amount" className="text-xs">
                  {debt ? "Reçu (€)" : "Débité (€)"}
                </Label>
                <Input
                  id="h-mv-amount"
                  inputMode="decimal"
                  value={shownMovement}
                  onChange={(e) => {
                    setMovementTouched(true);
                    setMovementAmount(e.target.value);
                  }}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs">Date</Label>
                <DatePicker value={movementDate} onChange={setMovementDate} />
              </div>
              {currency === "XOF" && (
                <p className="col-span-2 text-xs text-muted-foreground">
                  Converti au taux fixe 1 € = 655,957 FCFA — ajuste si le montant réel diffère.
                </p>
              )}
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            {debt
              ? "Le solde du compte augmente ; ce n’est pas compté comme une entrée du mois."
              : "Le solde du compte baisse ; ce n’est pas compté comme une dépense du mois."}
          </p>
        </fieldset>
      )}

      <Button type="submit" disabled={submitting}>
        {submitting ? "Enregistrement…" : isEdit ? "Enregistrer" : "Ajouter"}
      </Button>
    </form>
  );
}
