"use client";

import dynamic from "next/dynamic";

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

export function DashboardChartsLazy() {
  return <DashboardCharts />;
}
