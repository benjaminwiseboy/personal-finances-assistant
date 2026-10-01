"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChartColumn,
  HandCoins,
  LayoutDashboard,
  Receipt,
  Tags,
  Target,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useUpcomingDue } from "@/components/placements/use-upcoming-due";

const LINKS = [
  {
    href: "/dashboard",
    label: "Tableau de bord",
    short: "Bord",
    icon: LayoutDashboard,
  },
  { href: "/accounts", label: "Comptes", short: "Comptes", icon: Wallet },
  {
    href: "/transactions",
    label: "Transactions",
    short: "Trans.",
    icon: Receipt,
  },
  {
    href: "/placements",
    label: "Placements & dettes",
    short: "Placements",
    icon: HandCoins,
  },
  { href: "/budgets", label: "Budgets", short: "Budgets", icon: Target },
  { href: "/analyse", label: "Analyse", short: "Analyse", icon: ChartColumn },
  // Off the mobile tab bar (six tabs max); the mobile header links to it.
  {
    href: "/categories",
    label: "Catégories",
    short: "Catég.",
    icon: Tags,
    desktopOnly: true,
  },
];

/** Due-date alert count on the Placements entry (≤ 7 days or overdue). */
function DueBadge({ count, className }: { count: number; className?: string }) {
  if (count === 0) return null;
  return (
    <span
      aria-label={`${count} échéance${count > 1 ? "s" : ""} proche${count > 1 ? "s" : ""}`}
      className={cn(
        "bg-ember flex h-4 min-w-4 items-center justify-center rounded-full px-1 font-mono text-[0.6rem] font-semibold text-[oklch(0.16_0.02_45)]",
        className,
      )}
    >
      {count}
    </span>
  );
}

/** Vertical rail — desktop. The active item is lit from the left edge. */
export function NavRail({ className }: { className?: string }) {
  const pathname = usePathname();
  const { urgentCount } = useUpcomingDue();

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
              "focus-visible:ring-ember/60 focus-visible:ring-2 focus-visible:outline-none",
              active
                ? "from-ember/16 text-foreground bg-gradient-to-r to-transparent"
                : "text-muted-foreground hover:text-foreground hover:bg-white/[0.04]",
            )}
          >
            <span
              aria-hidden
              className={cn(
                "bg-ember absolute top-1/2 left-0 h-5 w-0.5 -translate-y-1/2 rounded-full transition-opacity",
                active ? "opacity-100" : "opacity-0",
              )}
            />
            <Icon
              className={cn(
                "size-4 shrink-0 transition-colors",
                active
                  ? "text-ember"
                  : "text-muted-foreground group-hover:text-foreground",
              )}
            />
            {link.label}
            {link.href === "/placements" && (
              <DueBadge count={urgentCount} className="ml-auto" />
            )}
          </Link>
        );
      })}
    </nav>
  );
}

/** Bottom tab bar — mobile. Thumb-reachable, PWA-native. */
export function NavTabs({ className }: { className?: string }) {
  const pathname = usePathname();
  const { urgentCount } = useUpcomingDue();

  return (
    <nav
      className={cn(
        "border-border bg-sidebar/95 grid grid-cols-6 gap-0.5 border-t px-0.5 pt-1 pb-[max(0.25rem,env(safe-area-inset-bottom))] backdrop-blur-xl",
        className,
      )}
    >
      {LINKS.filter((link) => !link.desktopOnly).map((link) => {
        const active = pathname.startsWith(link.href);
        const Icon = link.icon;
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex flex-col items-center gap-1 rounded-lg py-2 text-[0.625rem] font-medium transition-colors",
              "focus-visible:ring-ember/60 focus-visible:ring-2 focus-visible:outline-none",
              active ? "text-ember" : "text-muted-foreground",
            )}
          >
            <Icon className="size-5 shrink-0" />
            {link.href === "/placements" && (
              <DueBadge
                count={urgentCount}
                className="absolute top-1 left-1/2 ml-1.5"
              />
            )}
            {link.short}
          </Link>
        );
      })}
    </nav>
  );
}
