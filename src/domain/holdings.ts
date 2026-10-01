// Placements, prêts accordés et dettes — pure helpers shared by the UI, the
// data queries and the daily reminder job.

export type HoldingKind = "investment" | "loan" | "debt";
export type Currency = "EUR" | "XOF";
export type ReturnPeriod = "total" | "annual";
export type DuePrecision = "day" | "month" | "year";
export type HoldingStatus = "planned" | "sent" | "active" | "closed" | "defaulted";

export const KIND_LABELS: Record<HoldingKind, string> = {
  investment: "Investissement",
  loan: "Prêt accordé",
  debt: "Dette",
};

/** Section titles, in display order. */
export const KIND_SECTIONS: { kind: HoldingKind; title: string }[] = [
  { kind: "investment", title: "Investissements" },
  { kind: "loan", title: "Prêts accordés" },
  { kind: "debt", title: "Dettes" },
];

/** A debt is money received, so "sent" reads as "received" there. */
export function statusLabel(kind: HoldingKind, status: HoldingStatus): string {
  const debt = kind === "debt";
  switch (status) {
    case "planned":
      return debt ? "Prévue" : "Prévu";
    case "sent":
      return debt ? "Reçue" : "Envoyé";
    case "active":
      return "En cours";
    case "closed":
      return debt ? "Remboursée" : "Remboursé";
    case "defaulted":
      return debt ? "Annulée" : "Perdu";
  }
}

export const STATUSES: HoldingStatus[] = ["planned", "sent", "active", "closed", "defaulted"];

/** Closed and defaulted holdings no longer have a live due date. */
export function isOpen(status: HoldingStatus): boolean {
  return status !== "closed" && status !== "defaulted";
}

// Currency -------------------------------------------------------------------

/** Fixed parity of the CFA franc (BCEAO) to the euro. */
export const XOF_PER_EUR = 655.957;

export const CURRENCY_LABELS: Record<Currency, string> = {
  EUR: "€",
  XOF: "FCFA",
};

export function toEur(amount: number, currency: Currency): number {
  return currency === "XOF" ? amount / XOF_PER_EUR : amount;
}

export function formatAmount(amount: number, currency: Currency): string {
  if (currency === "XOF") {
    return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(amount)} FCFA`;
  }
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/** "3 M FCFA", "2,5 k €" — for tight spots like the dashboard. */
export function formatCompact(amount: number, currency: Currency): string {
  const n = new Intl.NumberFormat("fr-FR", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(amount);
  return `${n} ${CURRENCY_LABELS[currency]}`;
}

// Expected return ------------------------------------------------------------

/**
 * The gain the expected return represents, in the holding's currency: over
 * the whole life for "total", per year for "annual". Null when not set.
 */
export function expectedGain(
  amount: number,
  pct: number | null,
  period: ReturnPeriod,
): { value: number; perYear: boolean } | null {
  if (pct === null || Number.isNaN(pct)) return null;
  return { value: (amount * pct) / 100, perYear: period === "annual" };
}

export function formatPct(pct: number): string {
  const sign = pct > 0 ? "+" : "";
  return `${sign}${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(pct)} %`;
}

// Due dates ------------------------------------------------------------------

const pad = (n: number) => String(n).padStart(2, "0");

/** ISO date (yyyy-mm-dd) of `d`, read in local time. */
export function isoDay(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Normalises a due date to the stored form: last day of its month/year. */
export function normalizeDueDate(iso: string, precision: DuePrecision): string {
  const [y, m] = iso.split("-").map(Number);
  if (precision === "year") return `${y}-12-31`;
  if (precision === "month") {
    const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
    return `${y}-${pad(m)}-${pad(last)}`;
  }
  return iso;
}

const MONTH_YEAR = new Intl.DateTimeFormat("fr-FR", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});
const FULL_DATE = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

export function formatDue(iso: string, precision: DuePrecision): string {
  const d = new Date(`${iso}T00:00:00Z`);
  if (precision === "year") return String(d.getUTCFullYear());
  if (precision === "month") return MONTH_YEAR.format(d);
  return FULL_DATE.format(d);
}

/** Whole days from `today` to `due` (both ISO dates); negative when past. */
export function daysUntil(due: string, today: string): number {
  const ms = Date.parse(`${due}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}

export type Urgency = "overdue" | "soon" | "upcoming" | "later";

/** overdue < 0 ≤ soon ≤ 7 < upcoming ≤ 30 < later */
export function urgency(days: number): Urgency {
  if (days < 0) return "overdue";
  if (days <= 7) return "soon";
  if (days <= 30) return "upcoming";
  return "later";
}

/** "Aujourd'hui", "Demain", "Dans 12 jours", "En retard de 3 jours"… */
export function relativeDue(days: number): string {
  // Far off, count in months: "dans 374 jours" means little.
  if (days > 60) {
    const months = Math.round(days / 30.44);
    return `Dans ${months} mois`;
  }
  if (days === 0) return "Aujourd’hui";
  if (days === 1) return "Demain";
  if (days > 1) return `Dans ${days} jours`;
  if (days === -1) return "En retard d’1 jour";
  return `En retard de ${-days} jours`;
}

// Reminders ------------------------------------------------------------------

/** Days-before-due at which a reminder goes out; -1 = once, when overdue. */
export const REMINDER_MILESTONES = [30, 7, 1, 0, -1] as const;

/**
 * The reminder to send today, if any: the most urgent milestone already
 * reached that hasn't been sent for this due date. Earlier milestones that
 * were skipped (holding created late, job missed a day) are not replayed.
 */
export function reminderToSend(
  days: number,
  alreadySent: ReadonlySet<number>,
): number | null {
  const reached = REMINDER_MILESTONES.filter((m) =>
    m === -1 ? days < 0 : days <= m,
  );
  const mostUrgent = reached.at(-1);
  if (mostUrgent === undefined || alreadySent.has(mostUrgent)) return null;
  return mostUrgent;
}

export function reminderText(
  kind: HoldingKind,
  name: string,
  days: number,
): { title: string; body: string } {
  const what =
    kind === "debt" ? "Remboursement de ta dette" : kind === "loan" ? "Retour de ton prêt" : "Échéance de ton investissement";
  // "… dans 7 jours." / "… demain." / "… : en retard de 3 jours."
  const when = relativeDue(days).toLowerCase();
  return {
    title: name,
    body: days < 0 ? `${what} : ${when}.` : `${what} ${when}.`,
  };
}

// Movements & reste dû ----------------------------------------------------------

export type MovementDirection = "funding" | "repayment";

/** How a movement reads from the user's side, per kind of holding. */
export function movementLabel(kind: HoldingKind, direction: MovementDirection): string {
  if (kind === "debt") return direction === "funding" ? "Emprunté" : "Remboursé";
  return direction === "funding" ? "Versé" : "Reçu";
}

/**
 * Sign of the bank-side amount: money leaves the account when you invest,
 * lend or repay a debt; it comes in when you borrow or get paid back.
 */
export function bankSign(kind: HoldingKind, direction: MovementDirection): 1 | -1 {
  const outflow = (kind === "debt") === (direction === "repayment");
  return outflow ? -1 : 1;
}

export function fromEur(eur: number, currency: Currency): number {
  return currency === "XOF" ? eur * XOF_PER_EUR : eur;
}

/**
 * Below this, nothing is left to pay. For FCFA it absorbs the rounding of a
 * euro bank amount converted at the parity (0,005 € ≈ 3 FCFA).
 */
export function settledThreshold(currency: Currency): number {
  return currency === "XOF" ? 10 : 0.005;
}

/** Remaining capital and any surplus already received/paid on top of it. */
export function outstanding(amount: number, repaid: number, currency: Currency) {
  const remaining = Math.max(amount - repaid, 0);
  return {
    remaining: remaining <= settledThreshold(currency) ? 0 : remaining,
    surplus: Math.max(repaid - amount, 0),
    ratio: amount > 0 ? Math.min(repaid / amount, 1) : 0,
  };
}
