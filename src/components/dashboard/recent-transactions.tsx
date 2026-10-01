import { formatMoney } from "@/lib/money";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type TransactionRow = {
  id: string;
  date: string;
  description: string;
  amount: number;
};

const DAY_MONTH = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "short",
});

function formatDate(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : DAY_MONTH.format(parsed);
}

export function RecentTransactions({
  transactions,
}: {
  transactions: TransactionRow[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Dernières transactions</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col">
        {transactions.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Aucune transaction ce mois-ci. Ajoutez-en une pour suivre votre
            mois.
          </p>
        )}
        {transactions.map((tx) => {
          const incoming = tx.amount >= 0;
          return (
            <div
              key={tx.id}
              className="flex items-center gap-3 border-b border-white/[0.06] py-3 last:border-0 last:pb-0 first:pt-0"
            >
              <span
                aria-hidden
                className={`size-1.5 shrink-0 rounded-full ${
                  incoming ? "bg-mint-data" : "bg-ember"
                }`}
              />
              <span
                data-slot="figure"
                className="w-14 shrink-0 font-mono text-xs text-muted-foreground"
              >
                {formatDate(tx.date)}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm">
                {tx.description}
              </span>
              <span
                data-slot="figure"
                className={`shrink-0 text-sm font-medium ${
                  incoming ? "text-mint" : "text-foreground"
                }`}
              >
                {formatMoney(tx.amount)}
              </span>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
