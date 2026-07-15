import { logoutAction } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { NavLinks } from "./nav-links";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b border-border bg-card px-4 py-3">
        <span className="flex items-center gap-2 font-semibold">
          <span
            aria-hidden
            className="flex size-6 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground"
          >
            €
          </span>
          Mes Finances
        </span>
        <div className="flex items-center gap-4">
          <NavLinks className="hidden md:flex" />
          <form action={logoutAction}>
            <Button type="submit" variant="outline" size="sm">
              Déconnexion
            </Button>
          </form>
        </div>
      </header>
      <NavLinks className="flex overflow-x-auto border-b border-border bg-card px-2 py-1 md:hidden" />
      <main className="flex-1 p-4 md:p-6">{children}</main>
    </div>
  );
}
