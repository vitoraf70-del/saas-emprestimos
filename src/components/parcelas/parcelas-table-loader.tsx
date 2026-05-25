import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { formatDateBR } from "@/lib/date";
import {
  getParcelasResumoList,
  labelSituacaoParcelas,
  PARCELAS_RESUMO_PAGE_SIZE
} from "@/lib/queries/parcelas-resumo-list";
import { toCurrency } from "@/lib/utils";

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

export async function ParcelasTableLoader({
  nome,
  cpf,
  status,
  page
}: {
  nome?: string;
  cpf?: string;
  status?: "pendente" | "paga" | "vencida";
  page: number;
}) {
  const list = await getParcelasResumoList({ nome, cpf, status, page });
  const filters = { nome, cpf, status };

  return (
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
            <option value="">Status da parcela</option>
            <option value="pendente">Com pendente</option>
            <option value="vencida">Com vencida</option>
            <option value="paga">Com paga</option>
          </select>
          <button type="submit" className="rounded-md bg-primary p-2 text-primary-foreground">
            Filtrar
          </button>
        </form>

        <p className="mb-3 text-sm text-muted-foreground">
          {list.total} contrato(s) — página {list.page} de {list.totalPages} (até{" "}
          {PARCELAS_RESUMO_PAGE_SIZE} por página). Clique no cliente para ver cada parcela.
        </p>

        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50 text-left">
              <th className="p-3">Cliente</th>
              <th className="p-3">Parcelas</th>
              <th className="p-3">Próx. vencimento</th>
              <th className="p-3">Em aberto</th>
              <th className="p-3">Situação</th>
            </tr>
          </thead>
          <tbody>
            {list.rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-6 text-center text-muted-foreground">
                  Nenhum contrato encontrado com os filtros informados.
                </td>
              </tr>
            ) : (
              list.rows.map((row) => (
                <tr key={row.emprestimoId} className="border-b">
                  <td className="p-3">
                    <Link
                      className="text-primary underline-offset-2 hover:underline"
                      href={`/clientes/${row.clienteId}`}
                    >
                      {row.clienteNome}
                    </Link>
                  </td>
                  <td className="p-3">
                    {row.parcelasPagas}/{row.numeroParcelas} pagas
                    {row.parcelasVencidas > 0 ? (
                      <span className="ml-1 text-muted-foreground">
                        ({row.parcelasVencidas} vencida
                        {row.parcelasVencidas > 1 ? "s" : ""})
                      </span>
                    ) : null}
                  </td>
                  <td className="p-3">
                    {row.proximoVencimento ? formatDateBR(row.proximoVencimento) : "—"}
                  </td>
                  <td className="p-3">{toCurrency(row.emAberto)}</td>
                  <td className="p-3">{labelSituacaoParcelas(row.situacao)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {list.totalPages > 1 ? (
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            {list.page > 1 ? (
              <Link
                href={buildPageHref(filters, list.page - 1)}
                className="rounded-md border px-3 py-1 text-sm hover:bg-muted"
              >
                Anterior
              </Link>
            ) : null}
            <span className="text-sm text-muted-foreground">
              Página {list.page} de {list.totalPages}
            </span>
            {list.page < list.totalPages ? (
              <Link
                href={buildPageHref(filters, list.page + 1)}
                className="rounded-md border px-3 py-1 text-sm hover:bg-muted"
              >
                Próxima
              </Link>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
