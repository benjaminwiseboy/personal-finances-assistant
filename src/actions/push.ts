"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { sql } from "@/lib/db";
import { getUserId } from "@/lib/session";
import { pushConfigured, sendToUser } from "@/lib/push";

const SubscriptionSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({ p256dh: z.string().min(1), auth: z.string().min(1) }),
});

/** Registers this device for due-date reminders. */
export async function savePushSubscription(
  subscription: unknown,
): Promise<{ error?: string }> {
  const parsed = SubscriptionSchema.safeParse(subscription);
  if (!parsed.success) return { error: "Abonnement invalide" };

  const userId = await getUserId();
  if (!userId) return { error: "Non authentifié" };

  const { endpoint, keys } = parsed.data;
  const userAgent = (await headers()).get("user-agent");
  try {
    // An endpoint belongs to one browser install; re-subscribing refreshes it.
    await sql`
      insert into push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
      values (${userId}, ${endpoint}, ${keys.p256dh}, ${keys.auth}, ${userAgent})
      on conflict (endpoint) do update
        set user_id = excluded.user_id, p256dh = excluded.p256dh,
            auth = excluded.auth, user_agent = excluded.user_agent`;
  } catch {
    return { error: "Échec de l’activation des notifications" };
  }
  return {};
}

export async function removePushSubscription(endpoint: string): Promise<void> {
  const userId = await getUserId();
  if (!userId) return;
  await sql`
    delete from push_subscriptions
    where endpoint = ${endpoint} and user_id = ${userId}`;
}

export async function sendTestNotification(): Promise<{ error?: string }> {
  const userId = await getUserId();
  if (!userId) return { error: "Non authentifié" };
  if (!pushConfigured()) {
    return { error: "Notifications non configurées sur le serveur (clés VAPID)" };
  }
  const delivered = await sendToUser(userId, {
    title: "Mes Finances",
    body: "Les rappels d’échéance arriveront ici.",
    url: "/placements",
    tag: "test",
  });
  return delivered > 0 ? {} : { error: "Aucun appareil n’a reçu la notification" };
}
