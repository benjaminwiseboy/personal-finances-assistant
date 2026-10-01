import { Wordmark } from "@/components/layout/wordmark";

// Precached by the service worker and shown when a page is opened offline
// and isn't in the cache yet.
export default function OfflinePage() {
  return (
    <div className="ember-bloom flex min-h-screen items-center justify-center p-6">
      <div className="flex max-w-sm flex-col items-center gap-5 text-center">
        <Wordmark size="lg" className="flex-col gap-3" />
        <h1 className="font-display text-xl font-semibold">Vous êtes hors ligne</h1>
        <p className="text-sm text-balance text-muted-foreground">
          Cette page n’a pas encore été consultée sur cet appareil. Reconnectez-vous
          à Internet : l’application se rechargera d’elle-même.
        </p>
      </div>
    </div>
  );
}
