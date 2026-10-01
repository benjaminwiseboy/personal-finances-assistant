"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { KIND_SECTIONS, isOpen, toEur } from "@/domain/holdings";
import { fetchData } from "@/lib/fetch-data";
import type { HoldingRow } from "@/server/queries";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { HoldingDetail } from "@/components/placements/holding-detail";
import { HoldingForm } from "@/components/placements/holding-form";
import { HoldingList } from "@/components/placements/holding-list";
import { NotificationToggle } from "@/components/placements/notification-toggle";
import { PlacementsSummary } from "@/components/placements/placements-summary";

const EMPTY: Record<HoldingRow["kind"], string> = {
  investment: "Aucun investissement. Terrain, parts, business familial…",
  loan: "Aucun prêt accordé.",
  debt: "Aucune dette. Tant mieux.",
};

export default function PlacementsPage() {
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const { data: holdings = [] } = useQuery({
    queryKey: ["holdings"],
    queryFn: () => fetchData("holdings"),
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ["accounts", "options"],
    queryFn: () => fetchData("accountOptions"),
  });

  // Re-read the open holding from the list so edits show up immediately.
  const opened = holdings.find((h) => h.id === openId) ?? null;

  const totals = useMemo(() => {
    const t = { investment: 0, loan: 0, debt: 0 };
    for (const h of holdings) {
      if (isOpen(h.status)) t[h.kind] += toEur(h.amount, h.currency);
    }
    return t;
  }, [holdings]);

  function reload() {
    // Holding movements change balances and the transactions list too.
    for (const key of ["holdings", "upcoming-due", "accounts", "dashboard-balance", "dashboard-recent", "transactions"]) {
      queryClient.invalidateQueries({ queryKey: [key] });
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          Placements & dettes
        </h1>
        <Button onClick={() => setCreating(true)}>
          <Plus />
          Ajouter
        </Button>
      </div>

      <PlacementsSummary invested={totals.investment} lent={totals.loan} owed={totals.debt} />
      <NotificationToggle />

      {KIND_SECTIONS.map(({ kind, title }) => (
        <HoldingList
          key={kind}
          title={title}
          holdings={holdings.filter((h) => h.kind === kind)}
          empty={EMPTY[kind]}
          onOpen={(h) => setOpenId(h.id)}
        />
      ))}

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nouveau placement ou dette</DialogTitle>
          </DialogHeader>
          <HoldingForm
            accounts={accounts}
            onSuccess={() => {
              setCreating(false);
              reload();
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={!!opened} onOpenChange={(open) => !open && setOpenId(null)}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{opened?.name}</DialogTitle>
          </DialogHeader>
          {opened && (
            <HoldingDetail
              key={opened.id}
              holding={opened}
              accounts={accounts}
              onChanged={reload}
              onDeleted={() => {
                setOpenId(null);
                reload();
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
