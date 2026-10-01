"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChartColumn,
  LayoutDashboard,
  Receipt,
  Tags,
  Target,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/dashboard", label: "Tableau de bord", short: "Bord", icon: LayoutDashboard },
  { href: "/accounts", label: "Comptes", short: "Comptes", icon: Wallet },
  { href: "/transactions", label: "Transactions", short: "Trans.", icon: Receipt },
  { href: "/budgets", label: "Budgets", short: "Budgets", icon: Target },
  { href: "/analyse", label: "Analyse", short: "Analyse", icon: ChartColumn },
  { href: "/categories", label: "Catégories", short: "Catég.", icon: Tags },
];

/** Vertical rail — desktop. The active item is lit from the left edge. */
export function NavRail({ className }: { className?: string }) {
  const pathname = usePathname();

  return (
    <nav className={cn("flex flex-col gap-1", className)}>
      {LINKS.map((link) => {
        const active = pathname.startsWith(link.href);
        const Icon = link.icon;
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              "focus-visible:ring-2 focus-visible:ring-ember/60 focus-visible:outline-none",
              active
                ? "bg-gradient-to-r from-ember/16 to-transparent text-foreground"
                : "text-muted-foreground hover:bg-white/[0.04] hover:text-foreground",
            )}
          >
            <span
              aria-hidden
              className={cn(
                "absolute top-1/2 left-0 h-5 w-0.5 -translate-y-1/2 rounded-full bg-ember transition-opacity",
                active ? "opacity-100" : "opacity-0",
              )}
            />
            <Icon
              className={cn(
                "size-4 shrink-0 transition-colors",
                active ? "text-ember" : "text-muted-foreground group-hover:text-foreground",
              )}
            />
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Bottom tab bar — mobile. Thumb-reachable, PWA-native. */
export function NavTabs({ className }: { className?: string }) {
  const pathname = usePathname();

  return (
    <nav
      className={cn(
        "grid grid-cols-6 gap-0.5 border-t border-border bg-sidebar/95 px-0.5 pt-1 pb-[max(0.25rem,env(safe-area-inset-bottom))] backdrop-blur-xl",
        className,
      )}
    >
      {LINKS.map((link) => {
        const active = pathname.startsWith(link.href);
        const Icon = link.icon;
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex flex-col items-center gap-1 rounded-lg py-2 text-[0.625rem] font-medium transition-colors",
              "focus-visible:ring-2 focus-visible:ring-ember/60 focus-visible:outline-none",
              active ? "text-ember" : "text-muted-foreground",
            )}
          >
            <Icon className="size-5 shrink-0" />
            {link.short}
          </Link>
        );
      })}
    </nav>
  );
}
