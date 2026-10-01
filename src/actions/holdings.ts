"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { getUserId } from "@/lib/session";
import { toDecimal } from "@/lib/money";
import { normalizeDueDate, type HoldingKind } from "@/domain/holdings";
import {
  HoldingFormSchema,
  HoldingMovementSchema,
  type HoldingFormInput,
  type HoldingMovementInput,
} from "@/domain/validators";

function revalidate() {
  revalidatePath("/placements");
  revalidatePath("/accounts");
  revalidatePath("/transactions");
  revalidatePath("/dashboard");
}

/**
 * Money leaves the account when you invest, lend or repay a debt, and comes
 * in when you borrow or get paid back — so the creation movement of a debt is
 * an inflow, and of an investment/loan an outflow.
 */
function openingSign(kind: HoldingKind): 1 | -1 {
  return kind === "debt" ? 1 : -1;
}

async function ownsAccount(accountId: string, userId: string) {
  const rows = await sql`
    select 1 from accounts where id = ${accountId} and user_id = ${userId}`;
  return rows.length > 0;
}

export async function createHolding(
  input: HoldingFormInput,
): Promise<{ error?: string }> {
  const parsed = HoldingFormSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide" };
  }
  const d = parsed.data;

  const userId = await getUserId();
  if (!userId) return { error: "Non authentifié" };

  try {
    if (d.account_id && !(await ownsAccount(d.account_id, userId))) {
      return { error: "Compte introuvable" };
    }

    const id = randomUUID();
    const dueDate = d.due_date ? normalizeDueDate(d.due_date, d.due_precision) : null;
    const insertHolding = sql`
      insert into holdings (id, user_id, kind, name, description, currency, amount,
                            expected_return_pct, return_period, due_date,
                            due_precision, status)
      values (${id}, ${userId}, ${d.kind}, ${d.name}, ${d.description},
              ${d.currency}, ${d.amount}, ${d.expected_return_pct},
              ${d.return_period}, ${dueDate}, ${d.due_precision}, ${d.status})`;

    if (d.account_id && d.movement_amount && d.movement_date) {
      const signed = toDecimal(d.movement_amount).abs().times(openingSign(d.kind)).toFixed(2);
      await sql.transaction([
        insertHolding,
        sql`
          insert into transactions (user_id, account_id, holding_id, amount, date, description)
          values (${userId}, ${d.account_id}, ${id}, ${signed}, ${d.movement_date}, ${d.name})`,
      ]);
    } else {
      await insertHolding;
    }
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
  // addHoldingMovement, so the account fields are ignored here.
  const parsed = HoldingFormSchema.safeParse({ ...input, account_id: "" });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide" };
  }
  const d = parsed.data;

  const userId = await getUserId();
  if (!userId) return { error: "Non authentifié" };

  const dueDate = d.due_date ? normalizeDueDate(d.due_date, d.due_precision) : null;
  try {
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

/** Also removes its movements, which puts the account balances back. */
export async function deleteHolding(id: string): Promise<{ error?: string }> {
  const userId = await getUserId();
  if (!userId) return { error: "Non authentifié" };

  try {
    await sql`delete from holdings where id = ${id} and user_id = ${userId}`;
  } catch {
    return { error: "Échec de la suppression" };
  }

  revalidate();
  return {};
}

export async function addHoldingMovement(
  input: HoldingMovementInput,
): Promise<{ error?: string }> {
  const parsed = HoldingMovementSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide" };
  }
  const d = parsed.data;

  const userId = await getUserId();
  if (!userId) return { error: "Non authentifié" };

  try {
    const [holding] = await sql`
      select name from holdings where id = ${d.holding_id} and user_id = ${userId}`;
    if (!holding) return { error: "Placement introuvable" };
    if (!(await ownsAccount(d.account_id, userId))) {
      return { error: "Compte introuvable" };
    }

    const signed = toDecimal(d.amount).abs().times(d.direction === "out" ? -1 : 1);
    await sql`
      insert into transactions (user_id, account_id, holding_id, amount, date, description)
      values (${userId}, ${d.account_id}, ${d.holding_id}, ${signed.toFixed(2)},
              ${d.date}, ${d.description ?? holding.name})`;
  } catch {
    return { error: "Échec de l’enregistrement du mouvement" };
  }

  revalidate();
  return {};
}

export async function deleteHoldingMovement(
  transactionId: string,
): Promise<{ error?: string }> {
  const userId = await getUserId();
  if (!userId) return { error: "Non authentifié" };

  try {
    await sql`
      delete from transactions
      where id = ${transactionId} and user_id = ${userId}
        and holding_id is not null`;
  } catch {
    return { error: "Échec de la suppression du mouvement" };
  }

  revalidate();
  return {};
}
