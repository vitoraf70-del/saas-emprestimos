import { Suspense } from "react";
import { ParcelasTableLoader } from "@/components/parcelas/parcelas-table-loader";
import type { ParcelasResumoStatusFilter } from "@/lib/queries/parcelas-resumo-list";

function ParcelasTableSkeleton() {
  return (
    <div className="animate-pulse rounded-lg border p-4">
      <div className="mb-4 grid gap-2 md:grid-cols-4">
        <div className="h-10 rounded-md bg-muted" />
        <div className="h-10 rounded-md bg-muted" />
        <div className="h-10 rounded-md bg-muted" />
        <div className="h-10 rounded-md bg-muted" />
      </div>
      <div className="mb-3 h-4 w-72 rounded bg-muted" />
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-12 rounded bg-muted/60" />
        ))}
      </div>
    </div>
  );
}

export default function ParcelasPage({
  searchParams
}: {
  searchParams: { nome?: string; cpf?: string; status?: string; page?: string };
}) {
  const nome = searchParams.nome?.trim();
  const cpf = searchParams.cpf?.trim();
  const status = searchParams.status as ParcelasResumoStatusFilter | undefined;
  const page = Number(searchParams.page ?? "1") || 1;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Parcelas</h2>
      <Suspense
        key={`${nome ?? ""}-${cpf ?? ""}-${status ?? ""}-${page}`}
        fallback={<ParcelasTableSkeleton />}
      >
        <ParcelasTableLoader nome={nome} cpf={cpf} status={status} page={page} />
      </Suspense>
    </div>
  );
}
