import { recalculateOpenParcelas } from "@/actions/parcelas";
import { DashboardCharts } from "@/components/dashboard/charts";
import { OverviewCards } from "@/components/dashboard/overview-cards";
import { getDashboardData } from "@/lib/queries/dashboard";

export default async function DashboardPage() {
  await recalculateOpenParcelas();
  const data = await getDashboardData();

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Dashboard</h2>
      <OverviewCards data={data.cards} />
      <DashboardCharts />
    </div>
  );
}
