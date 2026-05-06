"use client";

import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const mockedMonthly = [
  { mes: "Jan", recebimentos: 12000, lucro: 2400, atraso: 8 },
  { mes: "Fev", recebimentos: 18000, lucro: 3900, atraso: 6 },
  { mes: "Mar", recebimentos: 21000, lucro: 5100, atraso: 4 },
  { mes: "Abr", recebimentos: 15000, lucro: 3300, atraso: 9 }
];

export function DashboardCharts() {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Recebimentos e Lucro Mensal</CardTitle>
        </CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={mockedMonthly}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="mes" />
              <YAxis />
              <Legend />
              <Bar dataKey="recebimentos" fill="#2563eb" />
              <Bar dataKey="lucro" fill="#10b981" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Taxa de atraso</CardTitle>
        </CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={mockedMonthly}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="mes" />
              <YAxis />
              <Legend />
              <Line dataKey="atraso" stroke="#ef4444" />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
