import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { MarcarParcelaPagaButton } from "@/components/parcelas/marcar-parcela-paga-button";
import { RetirarEncargosButton } from "@/components/parcelas/retirar-encargos-button";
import { formatDateBR } from "@/lib/date";
import { recalculateOpenParcelasData } from "@/lib/services/parcelas-recalculo";
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
  await recalculateOpenParcelasData();
  const list = await getParcelasList({ nome, cpf, status, page });
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
            <option value="">Todos os status</option>
            <option value="pendente">Pendente</option>
            <option value="vencida">Vencida</option>
            <option value="paga">Paga</option>
          </select>
          <button type="submit" className="rounded-md bg-primary p-2 text-primary-foreground">
            Filtrar
          </button>
        </form>

        <p className="mb-3 text-sm text-muted-foreground">
          {list.total} parcela(s) — página {list.page} de {list.totalPages} (até{" "}
          {PARCELAS_PAGE_SIZE} por página). Use &quot;Parcela paga&quot; para dar baixa em PIX
          recebido direto.
        </p>

        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50 text-left">
              <th className="p-3">Cliente</th>
              <th className="p-3">Parcela</th>
              <th className="p-3">Vencimento</th>
              <th className="p-3">Valor</th>
              <th className="p-3">Status</th>
              <th className="p-3">Ação</th>
            </tr>
          </thead>
          <tbody>
            {list.parcelas.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-6 text-center text-muted-foreground">
                  Nenhuma parcela encontrada com os filtros informados.
                </td>
              </tr>
            ) : (
              list.parcelas.map((parcela) => {
                const valorOriginal = Number(parcela.valor_original);
                const multa = Number(parcela.multa_valor);
                const juros = Number(parcela.juros_valor);
                const valor =
                  Number(parcela.valor_atualizado) || valorOriginal;
                const valorFormatado = toCurrency(valor);
                const temEncargos =
                  parcela.status !== "paga" &&
                  !parcela.encargos_isentos &&
                  (multa > 0 || juros > 0);

                return (
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
                    <td className="p-3">{formatDateBR(new Date(parcela.vencimento))}</td>
                    <td className="p-3">{valorFormatado}</td>
                    <td className="p-3">
                      {parcelaStatusLabel[parcela.status] ?? parcela.status}
                    </td>
                    <td className="p-3">
                      {parcela.status !== "paga" ? (
                        <div className="flex flex-wrap gap-2">
                          {temEncargos ? (
                            <RetirarEncargosButton
                              id={parcela.id}
                              clienteNome={parcela.emprestimo.cliente.nome}
                              numeroParcela={parcela.numero_parcela}
                              valorOriginal={toCurrency(valorOriginal)}
                              multa={toCurrency(multa)}
                              juros={toCurrency(juros)}
                            />
                          ) : null}
                          <MarcarParcelaPagaButton
                            id={parcela.id}
                            clienteNome={parcela.emprestimo.cliente.nome}
                            numeroParcela={parcela.numero_parcela}
                            valor={valorFormatado}
                          />
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                );
              })
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
