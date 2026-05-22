import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { formatDateBR } from "@/lib/date";
import { getParcelasList, PARCELAS_PAGE_SIZE } from "@/lib/queries/parcelas-list";
import { toCurrency } from "@/lib/utils";

const parcelaStatusLabel: Record<string, string> = {
  pendente: "Pendente",
  vencida: "Vencida",
  paga: "Paga"
};

function buildPageHref(
  base: { nome?: string; cpf?: string; status?: string },
  page: number
) {
  const params = new URLSearchParams();
  if (base.nome) params.set("nome", base.nome);
  if (base.cpf) params.set("cpf", base.cpf);
  if (base.status) params.set("status", base.status);
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `/parcelas?${qs}` : "/parcelas";
}

export default async function ParcelasPage({
  searchParams
}: {
  searchParams: { nome?: string; cpf?: string; status?: string; page?: string };
}) {
  const nome = searchParams.nome?.trim();
  const cpf = searchParams.cpf?.trim();
  const status = searchParams.status as "pendente" | "paga" | "vencida" | undefined;
  const page = Number(searchParams.page ?? "1") || 1;

  const { parcelas, total, totalPages, page: currentPage } = await getParcelasList({
    nome,
    cpf,
    status,
    page
  });

  const filters = { nome, cpf, status };

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Parcelas</h2>
      <Card>
        <CardContent className="p-4">
          <form className="mb-4 grid gap-2 md:grid-cols-4" method="get">
            <input
              name="nome"
              placeholder="Buscar por nome"
              defaultValue={nome ?? ""}
              className="rounded-md border p-2"
            />
            <input
              name="cpf"
              placeholder="CPF"
              defaultValue={cpf ?? ""}
              className="rounded-md border p-2"
            />
            <select name="status" defaultValue={status ?? ""} className="rounded-md border p-2">
              <option value="">Status</option>
              <option value="pendente">Pendente</option>
              <option value="vencida">Vencida</option>
              <option value="paga">Paga</option>
            </select>
            <button type="submit" className="rounded-md bg-primary p-2 text-primary-foreground">
              Filtrar
            </button>
          </form>

          <p className="mb-3 text-sm text-muted-foreground">
            {total} parcela(s) — página {currentPage} de {totalPages} (até {PARCELAS_PAGE_SIZE} por
            página)
          </p>

          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-left">
                <th className="p-3">Cliente</th>
                <th className="p-3">Parcela</th>
                <th className="p-3">Vencimento</th>
                <th className="p-3">Valor atualizado</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {parcelas.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-muted-foreground">
                    Nenhuma parcela encontrada com os filtros informados.
                  </td>
                </tr>
              ) : (
                parcelas.map((parcela) => (
                  <tr key={parcela.id} className="border-b">
                    <td className="p-3">
                      <Link
                        className="text-primary underline-offset-2 hover:underline"
                        href={`/clientes/${parcela.emprestimo.cliente_id}`}
                      >
                        {parcela.emprestimo.cliente.nome}
                      </Link>
                    </td>
                    <td className="p-3">{parcela.numero_parcela}</td>
                    <td className="p-3">{formatDateBR(parcela.vencimento)}</td>
                    <td className="p-3">
                      {toCurrency(Number(parcela.valor_atualizado || parcela.valor_original))}
                    </td>
                    <td className="p-3">{parcelaStatusLabel[parcela.status] ?? parcela.status}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {totalPages > 1 ? (
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              {currentPage > 1 ? (
                <Link
                  href={buildPageHref(filters, currentPage - 1)}
                  className="rounded-md border px-3 py-1 text-sm hover:bg-muted"
                >
                  Anterior
                </Link>
              ) : null}
              <span className="text-sm text-muted-foreground">
                Página {currentPage} de {totalPages}
              </span>
              {currentPage < totalPages ? (
                <Link
                  href={buildPageHref(filters, currentPage + 1)}
                  className="rounded-md border px-3 py-1 text-sm hover:bg-muted"
                >
                  Próxima
                </Link>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
