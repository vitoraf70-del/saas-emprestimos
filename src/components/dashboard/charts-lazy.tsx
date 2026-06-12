"use client";

import dynamic from "next/dynamic";
import type { MonthlyChartPoint } from "@/lib/queries/dashboard";

const DashboardCharts = dynamic(
  () => import("@/components/dashboard/charts").then((m) => m.DashboardCharts),
  {
    ssr: false,
    loading: () => (
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="h-72 animate-pulse rounded-lg border bg-muted/40" />
        <div className="h-72 animate-pulse rounded-lg border bg-muted/40" />
      </div>
    )
  }
);

type Props = {
  data: MonthlyChartPoint[];
};

export function DashboardChartsLazy({ data }: Props) {
  return <DashboardCharts data={data} />;
}
