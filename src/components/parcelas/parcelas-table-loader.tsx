import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { formatDateBR, formatDateWithWeekdayBR } from "@/lib/date";
import { dateFromCalendarDayKey } from "@/lib/finance";
import {
  getParcelasResumoList,
  getReceberHojeResumo,
  labelSituacaoParcelas,
  PARCELAS_RESUMO_PAGE_SIZE,
  type ParcelasResumoStatusFilter
} from "@/lib/queries/parcelas-resumo-list";
import { toCurrency } from "@/lib/utils";

const situacaoClass: Record<string, string> = {
  vencida: "text-red-600 font-medium",
  pendente: "text-amber-600",
  em_dia: "text-green-600",
  quitado: "text-muted-foreground"
};

function buildPageHref(
  base: { nome?: string; cpf?: string; status?: ParcelasResumoStatusFilter },
  page: number
) {
  const params = new URLSearchParams();
  if (base.nome) params.set("nome", base.nome);
  if (base.cpf) params.set("cpf", base.cpf);
  if (base.status && base.status !== "aberto") params.set("status", base.status);
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
  status?: ParcelasResumoStatusFilter;
  page: number;
}) {
  const effectiveStatus = status ?? "aberto";
  const [list, receberHoje] = await Promise.all([
    getParcelasResumoList({ nome, cpf, status: effectiveStatus, page }),
    getReceberHojeResumo()
  ]);
  const filters = { nome, cpf, status: effectiveStatus };
  const hojeLabel = formatDateWithWeekdayBR(dateFromCalendarDayKey(receberHoje.data)!);

  return (
    <>
      <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
        <p className="text-sm text-muted-foreground">A receber hoje — {hojeLabel}</p>
        <p className="text-2xl font-bold text-primary">{toCurrency(receberHoje.total)}</p>
        <p className="text-sm text-muted-foreground">
          {receberHoje.quantidade} parcela(s) com vencimento hoje
        </p>
      </div>

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
          <select name="status" defaultValue={effectiveStatus} className="rounded-md border p-2">
            <option value="aberto">Em aberto</option>
            <option value="vencida">Vencida</option>
            <option value="pendente">Pendente</option>
            <option value="quitado">Quitado</option>
            <option value="todos">Todos</option>
          </select>
          <button type="submit" className="rounded-md bg-primary p-2 text-primary-foreground">
            Filtrar
          </button>
        </form>

        <p className="mb-3 text-sm text-muted-foreground">
          {list.total} empréstimo(s) — página {list.page} de {list.totalPages} (até{" "}
          {PARCELAS_RESUMO_PAGE_SIZE} por página). Clique no cliente para dar baixa ou gerenciar
          parcelas.
        </p>

        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50 text-left">
              <th className="p-3">Cliente</th>
              <th className="p-3">Parcelas</th>
              <th className="p-3">Em aberto</th>
              <th className="p-3">Próx. vencimento</th>
              <th className="p-3">Situação</th>
              <th className="p-3">Ação</th>
            </tr>
          </thead>
          <tbody>
            {list.rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-6 text-center text-muted-foreground">
                  Nenhum empréstimo encontrado com os filtros informados.
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
                      <span className="ml-1 text-red-600">({row.parcelasVencidas} vencida(s))</span>
                    ) : null}
                  </td>
                  <td className="p-3">{row.emAberto > 0 ? toCurrency(row.emAberto) : "—"}</td>
                  <td className="p-3">
                    {row.proximoVencimento ? formatDateBR(row.proximoVencimento) : "—"}
                  </td>
                  <td className={`p-3 ${situacaoClass[row.situacao] ?? ""}`}>
                    {labelSituacaoParcelas(row.situacao)}
                  </td>
                  <td className="p-3">
                    <Link
                      href={`/clientes/${row.clienteId}`}
                      className="rounded-md border px-2 py-1 text-xs hover:bg-muted"
                    >
                      Gerenciar
                    </Link>
                  </td>
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
    </>
  );
}
