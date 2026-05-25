"use client";

import { Fragment, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { formatDateBR } from "@/lib/date";
import { DespesaListRow } from "@/lib/queries/despesas-list";
import { toCurrency } from "@/lib/utils";
import { ExcluirDespesaButton } from "@/components/despesas/excluir-despesa-button";
import { PagarDespesaParcelaButton } from "@/components/despesas/pagar-despesa-parcela-button";

type ParcelaItem = {
  id: string;
  numeroParcela: number;
  valor: number;
  vencimento: Date;
  status: string;
  dataPagamento: Date | null;
};

export function DespesasTable({
  rows,
  parcelasByDespesa
}: {
  rows: DespesaListRow[];
  parcelasByDespesa: Record<string, ParcelaItem[]>;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">Nenhuma despesa cadastrada.</CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50 text-left">
              <th className="p-3">Descrição</th>
              <th className="p-3">Total</th>
              <th className="p-3">Parcelas</th>
              <th className="p-3">Em aberto</th>
              <th className="p-3">Próx. vencimento</th>
              <th className="p-3 w-[1%] whitespace-nowrap text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const parcelas = parcelasByDespesa[row.id] ?? [];
              const expanded = expandedId === row.id;
              return (
                <Fragment key={row.id}>
                  <tr className="border-b">
                    <td className="p-3">
                      <button
                        type="button"
                        className="text-left font-medium text-primary underline-offset-2 hover:underline"
                        onClick={() => setExpandedId(expanded ? null : row.id)}
                      >
                        {row.descricao}
                      </button>
                    </td>
                    <td className="p-3">{toCurrency(row.valorTotal)}</td>
                    <td className="p-3">
                      {row.parcelado ? `${row.parcelasPagas}/${row.numeroParcelas}` : "À vista"}
                    </td>
                    <td className="p-3">{toCurrency(row.emAberto)}</td>
                    <td className="p-3">{row.proximoVencimento ? formatDateBR(row.proximoVencimento) : "—"}</td>
                    <td className="p-3 text-right">
                      <ExcluirDespesaButton id={row.id} descricao={row.descricao} />
                    </td>
                  </tr>
                  {expanded ? (
                    <tr className="border-b bg-muted/20">
                      <td colSpan={6} className="p-3">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-left text-muted-foreground">
                              <th className="pb-2 pr-3">#</th>
                              <th className="pb-2 pr-3">Valor</th>
                              <th className="pb-2 pr-3">Vencimento</th>
                              <th className="pb-2 pr-3">Status</th>
                              <th className="pb-2 text-right">Ação</th>
                            </tr>
                          </thead>
                          <tbody>
                            {parcelas.map((p) => (
                              <tr key={p.id}>
                                <td className="py-1 pr-3">{p.numeroParcela}</td>
                                <td className="py-1 pr-3">{toCurrency(p.valor)}</td>
                                <td className="py-1 pr-3">{formatDateBR(p.vencimento)}</td>
                                <td className="py-1 pr-3 capitalize">{p.status}</td>
                                <td className="py-1 text-right">
                                  <PagarDespesaParcelaButton id={p.id} paga={p.status === "paga"} />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
