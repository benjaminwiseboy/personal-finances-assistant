"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { getUserId } from "@/lib/session";
import { toDecimal } from "@/lib/money";
import {
  bankSign,
  fromEur,
  normalizeDueDate,
  type Currency,
  type HoldingKind,
} from "@/domain/holdings";
import {
  CompensationSchema,
  HoldingFormSchema,
  HoldingMovementSchema,
  type CompensationInput,
  type HoldingFormInput,
  type HoldingMovementInput,
} from "@/domain/validators";

function revalidate() {
  revalidatePath("/placements");
  revalidatePath("/accounts");
  revalidatePath("/transactions");
  revalidatePath("/dashboard");
}

const firstIssue = (e: { issues: { message: string }[] }) =>
  e.issues[0]?.message ?? "Formulaire invalide";

async function ownsAccount(accountId: string, userId: string) {
  const rows = await sql`
    select 1 from accounts where id = ${accountId} and user_id = ${userId}`;
  return rows.length > 0;
}

async function getHolding(id: string, userId: string) {
  const [row] = await sql`
    select id, kind, currency, name, amount::text as amount
    from holdings where id = ${id} and user_id = ${userId}`;
  return row as
    | { id: string; kind: HoldingKind; currency: Currency; name: string; amount: string }
    | undefined;
}

/**
 * Status follows the reste dû: an open holding whose capital is fully repaid
 * becomes "closed"; with `reopen`, a closed one that has something left again
 * (a repayment was deleted) goes back to "active". Same thresholds as
 * settledThreshold() in the domain.
 */
function syncStatus(holdingIds: string[], userId: string, reopen: boolean) {
  return sql`
    update holdings h
    set status = case when s.remaining <= s.threshold then 'closed' else 'active' end,
        updated_at = now()
    from (
      select h2.id,
             h2.amount - coalesce(sum(m.amount) filter (where m.direction = 'repayment'), 0)
               as remaining,
             case h2.currency when 'XOF' then 10 else 0.005 end as threshold
      from holdings h2
      left join holding_movements m on m.holding_id = h2.id
      where h2.id = any(${holdingIds}::uuid[]) and h2.user_id = ${userId}
      group by h2.id
    ) s
    where h.id = s.id
      and (
        (s.remaining <= s.threshold and h.status in ('planned', 'sent', 'active'))
        or (${reopen} and s.remaining > s.threshold and h.status = 'closed')
      )`;
}

// Holdings ----------------------------------------------------------------------

export async function createHolding(
  input: HoldingFormInput,
): Promise<{ error?: string }> {
  const parsed = HoldingFormSchema.safeParse(input);
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const d = parsed.data;

  const userId = await getUserId();
  if (!userId) return { error: "Non authentifié" };

  try {
    if (d.account_id && !(await ownsAccount(d.account_id, userId))) {
      return { error: "Compte introuvable" };
    }

    const id = randomUUID();
    const dueDate = d.due_date ? normalizeDueDate(d.due_date, d.due_precision) : null;
    const queries = [
      sql`
        insert into holdings (id, user_id, kind, name, description, currency, amount,
                              expected_return_pct, return_period, due_date,
                              due_precision, status)
        values (${id}, ${userId}, ${d.kind}, ${d.name}, ${d.description},
                ${d.currency}, ${d.amount}, ${d.expected_return_pct},
                ${d.return_period}, ${dueDate}, ${d.due_precision}, ${d.status})`,
    ];

    // The opening bank movement funds the whole declared amount.
    if (d.account_id && d.movement_amount && d.movement_date) {
      const txId = randomUUID();
      const signed = toDecimal(d.movement_amount)
        .abs()
        .times(bankSign(d.kind, "funding"))
        .toFixed(2);
      queries.push(
        sql`
          insert into transactions (id, user_id, account_id, holding_id, amount, date, description)
          values (${txId}, ${userId}, ${d.account_id}, ${id}, ${signed},
                  ${d.movement_date}, ${d.name})`,
        sql`
          insert into holding_movements (user_id, holding_id, direction, amount, date, transaction_id)
          values (${userId}, ${id}, 'funding', ${d.amount}, ${d.movement_date}, ${txId})`,
      );
    }
    await sql.transaction(queries);
  } catch {
    return { error: "Échec de l’enregistrement" };
  }

  revalidate();
  return {};
}

export async function updateHolding(
  id: string,
  input: HoldingFormInput,
): Promise<{ error?: string }> {
  // The opening movement is only set at creation; later ones go through
  // addHoldingMovement, so the account fields are ignored here. The status is
  // taken as given: setting a partly repaid debt to "closed" (forgiven) or a
  // settled one back to "active" is a deliberate choice.
  const parsed = HoldingFormSchema.safeParse({ ...input, account_id: "" });
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const d = parsed.data;

  const userId = await getUserId();
  if (!userId) return { error: "Non authentifié" };

  try {
    const current = await getHolding(id, userId);
    if (!current) return { error: "Placement introuvable" };
    if (current.kind !== d.kind) {
      const [{ n }] = await sql`
        select count(*)::int as n from holding_movements where holding_id = ${id}`;
      if (n > 0) {
        return {
          error: "Impossible de changer le type : des mouvements sont déjà enregistrés",
        };
      }
    }

    const dueDate = d.due_date ? normalizeDueDate(d.due_date, d.due_precision) : null;
    await sql`
      update holdings
      set kind = ${d.kind}, name = ${d.name}, description = ${d.description},
          currency = ${d.currency}, amount = ${d.amount},
          expected_return_pct = ${d.expected_return_pct},
          return_period = ${d.return_period}, due_date = ${dueDate},
          due_precision = ${d.due_precision}, status = ${d.status},
          updated_at = now()
      where id = ${id} and user_id = ${userId}`;
  } catch {
    return { error: "Échec de la mise à jour" };
  }

  revalidate();
  return {};
}

/**
 * Also removes its movements, which puts the account balances back, and the
 * other half of any compensation, which reopens the debt or loan it settled.
 */
export async function deleteHolding(id: string): Promise<{ error?: string }> {
  const userId = await getUserId();
  if (!userId) return { error: "Non authentifié" };

  try {
    const counterparts = (
      await sql`
        select distinct other.holding_id
        from holding_movements mine
        join holding_movements other
          on other.compensation_id = mine.compensation_id and other.id <> mine.id
        where mine.holding_id = ${id} and mine.user_id = ${userId}`
    ).map((r) => r.holding_id as string);

    await sql.transaction([
      sql`
        delete from holding_movements
        where user_id = ${userId} and compensation_id in (
          select compensation_id from holding_movements
          where holding_id = ${id} and compensation_id is not null
        )`,
      sql`delete from holdings where id = ${id} and user_id = ${userId}`,
      syncStatus(counterparts, userId, true),
    ]);
  } catch {
    return { error: "Échec de la suppression" };
  }

  revalidate();
  return {};
}

// Movements ---------------------------------------------------------------------

export async function addHoldingMovement(
  input: HoldingMovementInput,
): Promise<{ error?: string }> {
  const parsed = HoldingMovementSchema.safeParse(input);
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const d = parsed.data;

  const userId = await getUserId();
  if (!userId) return { error: "Non authentifié" };

  try {
    const holding = await getHolding(d.holding_id, userId);
    if (!holding) return { error: "Placement introuvable" };

    const movementId = randomUUID();
    const queries = [];

    if (d.account_id) {
      if (!(await ownsAccount(d.account_id, userId))) {
        return { error: "Compte introuvable" };
      }
      // `amount` is the euros on the account; the ledger counts it in the
      // holding's currency (parity conversion unless given explicitly).
      const eur = toDecimal(d.amount).abs();
      const ledger =
        d.holding_amount && holding.currency === "XOF"
          ? toDecimal(d.holding_amount).abs()
          : toDecimal(fromEur(eur.toNumber(), holding.currency));
      const txId = randomUUID();
      queries.push(
        sql`
          insert into transactions (id, user_id, account_id, holding_id, amount, date, description)
          values (${txId}, ${userId}, ${d.account_id}, ${holding.id},
                  ${eur.times(bankSign(holding.kind, d.direction)).toFixed(2)},
                  ${d.date}, ${d.note ?? holding.name})`,
        sql`
          insert into holding_movements (id, user_id, holding_id, direction, amount, date, note, transaction_id)
          values (${movementId}, ${userId}, ${holding.id}, ${d.direction},
                  ${ledger.toFixed(2)}, ${d.date}, ${d.note}, ${txId})`,
      );
    } else {
      // Hors compte: only the reste dû moves, in the holding's currency.
      queries.push(sql`
        insert into holding_movements (id, user_id, holding_id, direction, amount, date, note)
        values (${movementId}, ${userId}, ${holding.id}, ${d.direction},
                ${toDecimal(d.amount).abs().toFixed(2)}, ${d.date}, ${d.note})`);
    }
    queries.push(syncStatus([holding.id], userId, true));
    await sql.transaction(queries);
  } catch {
    return { error: "Échec de l’enregistrement du mouvement" };
  }

  revalidate();
  return {};
}

/** Your debtor pays your creditor directly: both sides drop together. */
export async function compensate(
  input: CompensationInput,
): Promise<{ error?: string }> {
  const parsed = CompensationSchema.safeParse(input);
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const d = parsed.data;

  const userId = await getUserId();
  if (!userId) return { error: "Non authentifié" };

  try {
    const [from, to] = await Promise.all([
      getHolding(d.from_holding_id, userId),
      getHolding(d.to_holding_id, userId),
    ]);
    if (!from || from.kind === "debt") return { error: "Prêt ou investissement introuvable" };
    if (!to || to.kind !== "debt") return { error: "Dette introuvable" };

    const compensationId = randomUUID();
    const note = d.note ?? `Compensation : ${from.name} → ${to.name}`;
    await sql.transaction([
      sql`
        insert into holding_movements (user_id, holding_id, direction, amount, date, note, compensation_id)
        values (${userId}, ${from.id}, 'repayment', ${d.from_amount}, ${d.date}, ${note}, ${compensationId}),
               (${userId}, ${to.id}, 'repayment', ${d.to_amount}, ${d.date}, ${note}, ${compensationId})`,
      syncStatus([from.id, to.id], userId, true),
    ]);
  } catch {
    return { error: "Échec de la compensation" };
  }

  revalidate();
  return {};
}

/**
 * Deletes a movement with whatever it's tied to: its bank transaction (the
 * account balance is restored) or the other half of its compensation.
 */
export async function deleteHoldingMovement(
  movementId: string,
): Promise<{ error?: string }> {
  const userId = await getUserId();
  if (!userId) return { error: "Non authentifié" };

  try {
    const [m] = await sql`
      select holding_id, transaction_id, compensation_id
      from holding_movements where id = ${movementId} and user_id = ${userId}`;
    if (!m) return { error: "Mouvement introuvable" };

    if (m.compensation_id) {
      const affected = (
        await sql`
          select holding_id from holding_movements
          where compensation_id = ${m.compensation_id} and user_id = ${userId}`
      ).map((r) => r.holding_id as string);
      await sql.transaction([
        sql`
          delete from holding_movements
          where compensation_id = ${m.compensation_id} and user_id = ${userId}`,
        syncStatus(affected, userId, true),
      ]);
    } else {
      await sql.transaction([
        m.transaction_id
          ? // Cascades to the movement.
            sql`delete from transactions where id = ${m.transaction_id} and user_id = ${userId}`
          : sql`delete from holding_movements where id = ${movementId} and user_id = ${userId}`,
        syncStatus([m.holding_id as string], userId, true),
      ]);
    }
  } catch {
    return { error: "Échec de la suppression du mouvement" };
  }

  revalidate();
  return {};
}

/** From the Transactions page: a bank line that belongs to a holding. */
export async function deleteHoldingTransaction(
  transactionId: string,
): Promise<{ error?: string }> {
  const userId = await getUserId();
  if (!userId) return { error: "Non authentifié" };

  try {
    const [t] = await sql`
      select holding_id from transactions
      where id = ${transactionId} and user_id = ${userId} and holding_id is not null`;
    if (!t) return { error: "Mouvement introuvable" };
    await sql.transaction([
      sql`delete from transactions where id = ${transactionId} and user_id = ${userId}`,
      syncStatus([t.holding_id as string], userId, true),
    ]);
  } catch {
    return { error: "Échec de la suppression du mouvement" };
  }

  revalidate();
  return {};
}
