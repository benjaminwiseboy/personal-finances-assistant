import Link from "next/link";
import { LogOut, Tags } from "lucide-react";
import { logoutAction } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { NavRail, NavTabs } from "./nav-links";
import { Wordmark } from "./wordmark";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="ember-bloom bg-background relative flex min-h-screen">
      {/* Rail — desktop */}
      <aside className="border-sidebar-border bg-sidebar/60 sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r px-3 py-5 backdrop-blur-xl md:flex">
        <div className="px-3 pb-6">
          <Wordmark />
        </div>
        <NavRail />
        <form action={logoutAction} className="mt-auto px-1">
          <Button
            type="submit"
            variant="ghost"
            className="text-muted-foreground w-full justify-start"
          >
            <LogOut />
            Déconnexion
          </Button>
        </form>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar — mobile only; the rail carries this on desktop */}
        <header className="border-border bg-background/80 sticky top-0 z-20 flex items-center justify-between border-b px-4 py-3 backdrop-blur-xl md:hidden">
          <Wordmark />
          <div className="flex items-center gap-1">
            <Link
              href="/categories"
              aria-label="Catégories"
              className="text-muted-foreground hover:text-foreground flex size-8 items-center justify-center rounded-lg transition-colors hover:bg-white/[0.06]"
            >
              <Tags className="size-4" />
            </Link>
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
          </div>
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
