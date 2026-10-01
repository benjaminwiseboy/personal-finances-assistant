import { LogOut } from "lucide-react";
import { logoutAction } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { NavRail, NavTabs } from "./nav-links";
import { Wordmark } from "./wordmark";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="ember-bloom relative flex min-h-screen bg-background">
      {/* Rail — desktop */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar/60 px-3 py-5 backdrop-blur-xl md:flex">
        <div className="px-3 pb-6">
          <Wordmark />
        </div>
        <NavRail />
        <form action={logoutAction} className="mt-auto px-1">
          <Button
            type="submit"
            variant="ghost"
            className="w-full justify-start text-muted-foreground"
          >
            <LogOut />
            Déconnexion
          </Button>
        </form>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar — mobile only; the rail carries this on desktop */}
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border bg-background/80 px-4 py-3 backdrop-blur-xl md:hidden">
          <Wordmark />
          <form action={logoutAction}>
            <Button
              type="submit"
              variant="ghost"
              size="icon-sm"
              aria-label="Déconnexion"
            >
              <LogOut />
            </Button>
          </form>
        </header>

        <main className="flex-1 p-4 pb-24 md:p-8 md:pb-8">
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </main>
      </div>

      {/* Tabs — mobile */}
      <NavTabs className="fixed inset-x-0 bottom-0 z-30 md:hidden" />
    </div>
  );
}
