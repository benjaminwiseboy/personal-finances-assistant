import { formatMoney } from "@/lib/money";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type TransactionRow = {
  id: string;
  date: string;
  description: string;
  amount: number;
};

export function RecentTransactions({
  transactions,
}: {
  transactions: TransactionRow[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-zinc-500">
          Transactions récentes
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {transactions.length === 0 && (
          <p className="text-sm text-zinc-500">
            Aucune transaction ce mois-ci.
          </p>
        )}
        {transactions.map((tx) => (
          <div key={tx.id} className="flex items-center justify-between text-sm">
            <span>
              {tx.date} — {tx.description}
            </span>
            <span
              className={tx.amount < 0 ? "text-red-600" : "text-emerald-600"}
            >
              {formatMoney(tx.amount)}
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
