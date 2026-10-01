import "server-only";
import webpush from "web-push";
import { sql } from "@/lib/db";

// Web Push with VAPID keys (generate once: `npx web-push generate-vapid-keys`).
// Without them, push is simply off: the dashboard and the nav badge still
// surface upcoming due dates.

export type PushPayload = { title: string; body: string; url: string; tag?: string };

export function pushConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY,
  );
}

let configured = false;
function configure() {
  if (configured) return;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? "mailto:admin@example.com",
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
  configured = true;
}

/**
 * Sends to every device of the user. Subscriptions the push service reports
 * as gone (404/410: app uninstalled, permission revoked) are deleted.
 * Returns how many devices accepted the message.
 */
export async function sendToUser(userId: string, payload: PushPayload): Promise<number> {
  if (!pushConfigured()) return 0;
  configure();

  const subs = (await sql`
    select id, endpoint, p256dh, auth from push_subscriptions
    where user_id = ${userId}`) as { id: string; endpoint: string; p256dh: string; auth: string }[];

  let delivered = 0;
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(payload),
          { TTL: 60 * 60 * 24 },
        );
        delivered++;
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await sql`delete from push_subscriptions where id = ${s.id}`;
        } else {
          console.error("push failed", status, (error as Error).message);
        }
      }
    }),
  );
  return delivered;
}
