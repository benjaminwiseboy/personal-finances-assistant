"use client";

import { useActionState, useEffect } from "react";
import { loginAction } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Wordmark } from "@/components/layout/wordmark";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(loginAction, null);

  // Signed out (or session expired): drop the data the service worker kept
  // for offline reading, so the next person on this device can't see it.
  useEffect(() => {
    if ("caches" in window) void caches.delete("apis");
  }, []);

  return (
    <div className="ember-bloom relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-4">
      <div className="relative w-full max-w-sm">
        <div className="surface rounded-3xl bg-card p-8 ring-1 ring-white/10">
          <div className="flex flex-col items-center gap-6 text-center">
            <Wordmark size="lg" className="flex-col gap-3" />
            <p className="text-sm text-balance text-muted-foreground">
              Suivez ce qui entre, ce qui sort, et ce qu’il vous reste.
            </p>
          </div>

          <form action={formAction} className="mt-8 flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" required autoFocus />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="password">Mot de passe</Label>
              <Input id="password" name="password" type="password" required />
            </div>
            {state?.error && (
              <p
                className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive ring-1 ring-destructive/20"
                role="alert"
              >
                {state.error}
              </p>
            )}
            <Button type="submit" size="lg" disabled={pending} className="mt-2">
              {pending ? "Connexion…" : "Se connecter"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
