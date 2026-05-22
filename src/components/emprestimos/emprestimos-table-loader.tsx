import { EmprestimosListClient } from "@/components/emprestimos/emprestimos-list-client";
import { getEmprestimosList } from "@/lib/queries/emprestimos-list";

export async function EmprestimosTableLoader({
  nome,
  status,
  page
}: {
  nome?: string;
  status?: "ativo" | "quitado" | "inadimplente";
  page: number;
}) {
  const list = await getEmprestimosList({ nome, status, page });

  return (
    <EmprestimosListClient
      emprestimos={list.rows}
      total={list.total}
      currentPage={list.page}
      totalPages={list.totalPages}
      filters={{ nome, status }}
    />
  );
}
