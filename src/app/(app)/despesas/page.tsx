import Link from "next/link";
import { NovaDespesaModal } from "@/components/despesas/nova-despesa-modal";
import { DespesasTable } from "@/components/despesas/despesas-table";
import { getDespesaParcelas, getDespesasList } from "@/lib/queries/despesas-list";

export default async function DespesasPage({ searchParams }: { searchParams: { page?: string } }) {
  const page = Number(searchParams.page ?? "1") || 1;
  const { rows, totalPages } = await getDespesasList(page);

  const parcelas = rows.length ? await getDespesaParcelas(rows.map((r) => r.id)) : [];
  const parcelasByDespesa = parcelas.reduce<Record<string, typeof parcelas>>((acc, p) => {
    if (!acc[p.despesaId]) acc[p.despesaId] = [];
    acc[p.despesaId].push(p);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <DespesasPageHeader />
      <DespesasTable rows={rows} parcelasByDespesa={parcelasByDespesa} />
      {totalPages > 1 ? <DespesasPagination page={page} totalPages={totalPages} /> : null}
    </div>
  );
}

function DespesasPageHeader() {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="text-2xl font-bold">Despesas</h2>
      <NovaDespesaModal />
    </div>
  );
}

function DespesasPagination({ page, totalPages }: { page: number; totalPages: number }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {page > 1 ? (
        <Link className="underline" href={`/despesas?page=${page - 1}`}>
          Anterior
        </Link>
      ) : null}
      <span>
        Página {page} de {totalPages}
      </span>
      {page < totalPages ? (
        <Link className="underline" href={`/despesas?page=${page + 1}`}>
          Próxima
        </Link>
      ) : null}
    </div>
  );
}
