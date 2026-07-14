import { formatMoney } from "@/lib/money";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function KpiCards({
  totalIncome,
  totalExpense,
  net,
}: {
  totalIncome: number;
  totalExpense: number;
  net: number;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-zinc-500">
            Total des entrées
          </CardTitle>
        </CardHeader>
        <CardContent className="text-2xl font-semibold text-emerald-600">
          {formatMoney(totalIncome)}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-zinc-500">
            Total des sorties
          </CardTitle>
        </CardHeader>
        <CardContent className="text-2xl font-semibold text-red-600">
          {formatMoney(totalExpense)}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-zinc-500">
            Reste à vivre
          </CardTitle>
        </CardHeader>
        <CardContent
          className={`text-2xl font-semibold ${net >= 0 ? "text-emerald-600" : "text-red-600"}`}
        >
          {formatMoney(net)}
        </CardContent>
      </Card>
    </div>
  );
}
