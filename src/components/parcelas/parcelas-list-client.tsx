"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MarcarParcelaPagaButton } from "@/components/parcelas/marcar-parcela-paga-button";
import { RetirarEncargosButton } from "@/components/parcelas/retirar-encargos-button";
import { formatDateBR } from "@/lib/date";
import {
  labelSituacaoParcelas,
  PARCELAS_RESUMO_PAGE_SIZE,
  type ParcelaAbertaRow,
  type ParcelasResumoRow,
  type ParcelasResumoStatusFilter
} from "@/lib/queries/parcelas-resumo-list";
import { toCurrency } from "@/lib/utils";

const situacaoClass: Record<string, string> = {
  vencida: "text-red-600 font-medium",
  pendente: "text-amber-600",
  em_dia: "text-green-600",
  quitado: "text-muted-foreground"
};

const parcelaStatusLabel: Record<string, string> = {
  pendente: "Pendente",
  vencida: "Vencida",
  paga: "Paga"
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

type BaixaTarget = {
  clienteNome: string;
  parcelasAbertas: ParcelaAbertaRow[];
};

type Props = {
  rows: ParcelasResumoRow[];
  total: number;
  currentPage: number;
  totalPages: number;
  filters: { nome?: string; cpf?: string; status?: ParcelasResumoStatusFilter };
};

export function ParcelasListClient({ rows, total, currentPage, totalPages, filters }: Props) {
  const [baixaTarget, setBaixaTarget] = useState<BaixaTarget | null>(null);
  const effectiveStatus = filters.status ?? "aberto";

  return (
    <>
      <Card>
        <CardContent className="p-4">
          <form className="mb-4 grid gap-2 md:grid-cols-4" method="get">
            <input
              name="nome"
              placeholder="Buscar por nome"
              defaultValue={filters.nome ?? ""}
              className="rounded-md border p-2"
            />
            <input
              name="cpf"
              placeholder="CPF"
              defaultValue={filters.cpf ?? ""}
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
            {total} empréstimo(s) — página {currentPage} de {totalPages} (até{" "}
            {PARCELAS_RESUMO_PAGE_SIZE} por página). Use &quot;Dar baixa&quot; para marcar parcela
            paga quando o PIX chegar em outra conta.
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
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-muted-foreground">
                    Nenhum empréstimo encontrado com os filtros informados.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
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
                        <span className="ml-1 text-red-600">
                          ({row.parcelasVencidas} vencida(s))
                        </span>
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
                      {row.parcelasAbertas.length > 0 ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setBaixaTarget({
                              clienteNome: row.clienteNome,
                              parcelasAbertas: row.parcelasAbertas
                            })
                          }
                        >
                          Dar baixa
                        </Button>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
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

      <Dialog
        open={baixaTarget !== null}
        onOpenChange={(open) => {
          if (!open) setBaixaTarget(null);
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Dar baixa — {baixaTarget?.clienteNome}</DialogTitle>
          </DialogHeader>
          {baixaTarget ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Marque como paga a parcela recebida por PIX direto ou outro meio.
              </p>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50 text-left">
                    <th className="p-2">Parcela</th>
                    <th className="p-2">Vencimento</th>
                    <th className="p-2">Valor</th>
                    <th className="p-2">Status</th>
                    <th className="p-2">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {baixaTarget.parcelasAbertas.map((parcela) => {
                    const valor =
                      parcela.valorAtualizado > 0 ? parcela.valorAtualizado : parcela.valorOriginal;
                    const valorFormatado = toCurrency(valor);
                    const temEncargos =
                      !parcela.encargosIsentos && (parcela.multa > 0 || parcela.juros > 0);

                    return (
                      <tr key={parcela.id} className="border-b">
                        <td className="p-2">{parcela.numeroParcela}</td>
                        <td className="p-2">{formatDateBR(parcela.vencimento)}</td>
                        <td className="p-2">{valorFormatado}</td>
                        <td className="p-2">
                          {parcelaStatusLabel[parcela.status] ?? parcela.status}
                        </td>
                        <td className="p-2">
                          <div className="flex flex-wrap gap-2">
                            {temEncargos ? (
                              <RetirarEncargosButton
                                id={parcela.id}
                                clienteNome={baixaTarget.clienteNome}
                                numeroParcela={parcela.numeroParcela}
                                valorOriginal={toCurrency(parcela.valorOriginal)}
                                multa={toCurrency(parcela.multa)}
                                juros={toCurrency(parcela.juros)}
                              />
                            ) : null}
                            <MarcarParcelaPagaButton
                              id={parcela.id}
                              clienteNome={baixaTarget.clienteNome}
                              numeroParcela={parcela.numeroParcela}
                              valor={valorFormatado}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
