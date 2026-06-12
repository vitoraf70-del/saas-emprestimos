import { DashboardChartsLazy } from "@/components/dashboard/charts-lazy";
import { OverviewCards } from "@/components/dashboard/overview-cards";
import { getDashboardData } from "@/lib/queries/dashboard";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const data = await getDashboardData();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Dashboard</h2>
        <p className="text-sm text-muted-foreground">Visão geral do seu negócio</p>
      </div>
      <OverviewCards data={data.cards} />
      <DashboardChartsLazy data={data.charts.monthly} />
    </div>
  );
}
