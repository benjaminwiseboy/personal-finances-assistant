"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { daysUntil, isoDay, urgency } from "@/domain/holdings";
import { fetchData } from "@/lib/fetch-data";

/**
 * Open holdings due within 60 days (or overdue), plus how many need action
 * now (≤ 7 days or overdue). That count also goes on the installed app's
 * icon badge, where the platform supports it.
 */
export function useUpcomingDue() {
  const { data: upcoming = [] } = useQuery({
    queryKey: ["upcoming-due"],
    queryFn: () => fetchData("upcomingDue"),
    staleTime: 5 * 60 * 1000,
  });

  const today = isoDay(new Date());
  const items = upcoming.map((h) => ({ ...h, days: daysUntil(h.due_date!, today) }));
  const urgentCount = items.filter((h) => {
    const u = urgency(h.days);
    return u === "overdue" || u === "soon";
  }).length;

  useEffect(() => {
    const nav = navigator as Navigator & {
      setAppBadge?: (n: number) => Promise<void>;
      clearAppBadge?: () => Promise<void>;
    };
    if (urgentCount > 0) void nav.setAppBadge?.(urgentCount).catch(() => {});
    else void nav.clearAppBadge?.().catch(() => {});
  }, [urgentCount]);

  return { items, urgentCount };
}
