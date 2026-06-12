"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { MonthlyChartPoint } from "@/lib/queries/dashboard";
import { toCurrency } from "@/lib/utils";

type Props = {
  data: MonthlyChartPoint[];
};

function formatCurrencyAxis(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}k`;
  return String(value);
}

export function DashboardCharts({ data }: Props) {
  const hasData = data.some((row) => row.recebimentos > 0 || row.lucro !== 0 || row.atraso > 0);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Recebimentos e Lucro Mensal</CardTitle>
        </CardHeader>
        <CardContent className="h-72">
          {!hasData ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Sem movimentação nos últimos {data.length} meses.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="mes" />
                <YAxis tickFormatter={formatCurrencyAxis} />
                <Tooltip
                  formatter={(value: number, name: string) => [
                    toCurrency(value),
                    name === "recebimentos" ? "Recebimentos" : "Lucro"
                  ]}
                />
                <Legend formatter={(value) => (value === "recebimentos" ? "Recebimentos" : "Lucro")} />
                <Bar dataKey="recebimentos" fill="#2563eb" name="recebimentos" />
                <Bar dataKey="lucro" fill="#10b981" name="lucro" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Taxa de atraso</CardTitle>
        </CardHeader>
        <CardContent className="h-72">
          {!hasData ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Sem parcelas com vencimento nos últimos {data.length} meses.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="mes" />
                <YAxis tickFormatter={(value) => `${value}%`} domain={[0, "auto"]} />
                <Tooltip formatter={(value: number) => [`${value.toFixed(1)}%`, "Atraso"]} />
                <Legend formatter={() => "Atraso"} />
                <Line dataKey="atraso" stroke="#ef4444" name="atraso" dot />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
