import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

// defaultCache already serves /api/auth network-only and /api/* (our
// /api/data reads) network-first, so the last-seen figures stay readable
// offline. The login page purges that "apis" cache on sign-out.
const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
  fallbacks: {
    entries: [
      {
        url: "/~offline",
        matcher: ({ request }) => request.destination === "document",
      },
    ],
  },
});

serwist.addEventListeners();

// Due-date reminders (see src/server/reminders.ts) -----------------------------

self.addEventListener("push", (event) => {
  const data = (event.data?.json() ?? {}) as {
    title?: string;
    body?: string;
    url?: string;
    tag?: string;
  };
  event.waitUntil(
    self.registration.showNotification(data.title ?? "Mes Finances", {
      body: data.body,
      tag: data.tag,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url: data.url ?? "/placements" },
    }),
  );
});

// Focus an open window of the app if there is one, else open a new one.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data as { url?: string } | undefined)?.url ?? "/";
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const client = windows.find((w) => new URL(w.url).origin === self.location.origin);
      if (client) {
        await client.focus();
        await client.navigate(url);
      } else {
        await self.clients.openWindow(url);
      }
    })(),
  );
});
