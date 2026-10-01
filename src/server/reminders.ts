import "server-only";
import { sql } from "@/lib/db";
import { sendToUser } from "@/lib/push";
import {
  daysUntil,
  reminderText,
  reminderToSend,
  type DuePrecision,
  type HoldingKind,
} from "@/domain/holdings";

/** Today's date in Paris, as yyyy-mm-dd (the cron runs in UTC). */
export function parisToday(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(now);
}

/**
 * Daily job: for every open holding with a due date, push the most urgent
 * reminder not yet sent (30, 7, 1, 0 days before, then once when overdue).
 * A reminder is recorded only once at least one device received it, so
 * enabling notifications later still delivers the current one.
 */
export async function runDueReminders(today = parisToday()) {
  const rows = (await sql`
    select h.id, h.user_id, h.kind, h.name, h.due_date::text as due_date,
           h.due_precision,
           coalesce(array_agg(r.milestone) filter (where r.milestone is not null), '{}') as sent
    from holdings h
    left join holding_reminders r
      on r.holding_id = h.id and r.due_date = h.due_date
    where h.due_date is not null
      and h.status not in ('closed', 'defaulted')
      and h.due_date <= ${today}::date + 30
    group by h.id`) as {
    id: string;
    user_id: string;
    kind: HoldingKind;
    name: string;
    due_date: string;
    due_precision: DuePrecision;
    sent: number[];
  }[];

  let sent = 0;
  for (const h of rows) {
    const days = daysUntil(h.due_date, today);
    const milestone = reminderToSend(days, new Set(h.sent));
    if (milestone === null) continue;

    const text = reminderText(h.kind, h.name, days);
    const delivered = await sendToUser(h.user_id, {
      ...text,
      url: "/placements",
      tag: `holding-${h.id}`,
    });
    if (delivered > 0) {
      await sql`
        insert into holding_reminders (holding_id, due_date, milestone)
        values (${h.id}, ${h.due_date}, ${milestone})
        on conflict do nothing`;
      sent++;
    }
  }
  return { checked: rows.length, sent };
}
