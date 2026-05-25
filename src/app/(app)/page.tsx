import { DashboardChartsLazy } from "@/components/dashboard/charts-lazy";
import { OverviewCards } from "@/components/dashboard/overview-cards";
import { getDashboardData } from "@/lib/queries/dashboard";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const data = await getDashboardData();

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Dashboard</h2>
      <OverviewCards data={data.cards} />
      <DashboardChartsLazy />
    </div>
  );
}
