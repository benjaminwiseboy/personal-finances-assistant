"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, BellRing } from "lucide-react";
import { toast } from "sonner";
import {
  removePushSubscription,
  savePushSubscription,
  sendTestNotification,
} from "@/actions/push";
import { Button } from "@/components/ui/button";

type State = "loading" | "unsupported" | "needs-install" | "denied" | "off" | "on";

const VAPID_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

function urlBase64ToUint8Array(base64: string) {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4))
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

function isIos() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

async function currentSubscription() {
  const reg = await navigator.serviceWorker.getRegistration();
  return (await reg?.pushManager.getSubscription()) ?? null;
}

/**
 * Turns due-date reminders on for this device. On iPhone, Web Push only
 * exists once the app is added to the home screen, so we say so instead of
 * showing a button that can't work.
 */
export function NotificationToggle() {
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      if (isIos() && !isStandalone()) return setState("needs-install");
      if (!VAPID_KEY || !("serviceWorker" in navigator) || !("PushManager" in window)) {
        return setState("unsupported");
      }
      if (Notification.permission === "denied") return setState("denied");
      setState((await currentSubscription()) ? "on" : "off");
    })();
  }, []);

  async function enable() {
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "off");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_KEY!),
        }));
      const result = await savePushSubscription(sub.toJSON());
      if (result.error) throw new Error(result.error);
      setState("on");
      toast.success("Rappels activés sur cet appareil");
    } catch (error) {
      toast.error((error as Error).message || "Impossible d’activer les notifications");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    const sub = await currentSubscription();
    if (sub) {
      await removePushSubscription(sub.endpoint);
      await sub.unsubscribe();
    }
    setState("off");
    setBusy(false);
  }

  async function test() {
    setBusy(true);
    const result = await sendTestNotification();
    setBusy(false);
    if (result.error) toast.error(result.error);
  }

  if (state === "loading") return null;

  const message: Record<Exclude<State, "loading" | "off" | "on">, string> = {
    "needs-install":
      "Sur iPhone, ajoute d’abord l’app à l’écran d’accueil (Partager → Sur l’écran d’accueil), puis ouvre-la depuis l’icône pour activer les rappels.",
    unsupported: "Les notifications ne sont pas disponibles ici. Les échéances restent visibles sur le tableau de bord.",
    denied: "Les notifications sont bloquées pour cette app. Réautorise-les dans les réglages du navigateur ou du téléphone.",
  };

  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-white/[0.03] p-4 ring-1 ring-white/10 sm:flex-row sm:items-center">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-ember/12 text-ember ring-1 ring-ember/25">
        {state === "on" ? <BellRing className="size-4" /> : state === "off" ? <Bell className="size-4" /> : <BellOff className="size-4" />}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-sm font-medium">Rappels d’échéance</span>
        <span className="text-xs text-muted-foreground">
          {state === "on"
            ? "Activés sur cet appareil : 30 jours, 7 jours, la veille et le jour J."
            : state === "off"
              ? "Reçois une notification 30 jours, 7 jours, la veille et le jour de chaque échéance."
              : message[state]}
        </span>
      </div>
      {state === "off" && (
        <Button size="sm" onClick={enable} disabled={busy}>
          Activer
        </Button>
      )}
      {state === "on" && (
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={test} disabled={busy}>
            Tester
          </Button>
          <Button size="sm" variant="ghost" onClick={disable} disabled={busy}>
            Désactiver
          </Button>
        </div>
      )}
    </div>
  );
}
