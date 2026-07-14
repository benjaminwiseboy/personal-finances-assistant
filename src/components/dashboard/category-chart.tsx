"use client";

import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { formatMoney } from "@/lib/money";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const COLORS = [
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#06b6d4",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
];

type CategorySlice = { category_name: string; total: number };

export function CategoryChart({ data }: { data: CategorySlice[] }) {
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-zinc-500">
            Répartition des dépenses
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-zinc-500">
          Aucune dépense ce mois-ci.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-zinc-500">
          Répartition des dépenses
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <PieChart>
            <Pie
              data={data}
              dataKey="total"
              nameKey="category_name"
              cx="50%"
              cy="50%"
              outerRadius={100}
              label={(entry: { name?: string | number }) => entry.name}
            >
              {data.map((_, index) => (
                <Cell key={index} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(value) => formatMoney(Number(value ?? 0))} />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
