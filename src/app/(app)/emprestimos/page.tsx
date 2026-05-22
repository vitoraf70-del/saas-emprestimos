import { Suspense } from "react";
import { EmprestimosTableLoader } from "@/components/emprestimos/emprestimos-table-loader";
import { EmprestimosToolbar } from "@/components/emprestimos/emprestimos-toolbar";

function EmprestimosTableSkeleton() {
  return (
    <div className="animate-pulse rounded-lg border p-4">
      <div className="mb-4 grid gap-2 md:grid-cols-4">
        <div className="h-10 rounded-md bg-muted" />
        <div className="h-10 rounded-md bg-muted" />
        <div className="h-10 rounded-md bg-muted md:col-span-2" />
      </div>
      <div className="mb-3 h-4 w-64 rounded bg-muted" />
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-12 rounded bg-muted/60" />
        ))}
      </div>
    </div>
  );
}

export default function EmprestimosPage({
  searchParams
}: {
  searchParams: { nome?: string; status?: string; page?: string };
}) {
  const nome = searchParams.nome?.trim();
  const status = searchParams.status as "ativo" | "quitado" | "inadimplente" | undefined;
  const page = Number(searchParams.page ?? "1") || 1;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-2xl font-bold">Empréstimos</h2>
        <EmprestimosToolbar />
      </div>

      <Suspense key={`${nome ?? ""}-${status ?? ""}-${page}`} fallback={<EmprestimosTableSkeleton />}>
        <EmprestimosTableLoader nome={nome} status={status} page={page} />
      </Suspense>
    </div>
  );
}
