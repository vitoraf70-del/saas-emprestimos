"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatDateBR } from "@/lib/date";
import { calendarDayKeyBR } from "@/lib/finance";
import type { ConsultaPorDataResult } from "@/lib/queries/emprestimos-por-data";
import { toCurrency } from "@/lib/utils";

const emprestimoStatusLabel: Record<string, string> = {
  ativo: "Ativo",
  quitado: "Quitado",
  inadimplente: "Inadimplente"
};

function formatTimeBR(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Campo_Grande"
  });
}

export function ConsultarPorDataModal() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState(() => calendarDayKeyBR(new Date()));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ConsultaPorDataResult | null>(null);

  const buscar = useCallback(async (dayKey: string) => {
    setLoading(true);
    setError("");

    const response = await fetch(`/api/emprestimos/por-data?data=${encodeURIComponent(dayKey)}`);
    setLoading(false);

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "Não foi possível carregar os dados.");
      setResult(null);
      return;
    }

    setResult((await response.json()) as ConsultaPorDataResult);
  }, []);

  useEffect(() => {
    if (open) void buscar(data);
  }, [open, data, buscar]);

  return (
    <>
      <Button type="button" variant="outline" onClick={() => setOpen(true)}>
        Consultar por data
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Empréstimos e clientes por data</DialogTitle>
          </DialogHeader>

          <div className="grid gap-3">
            <label className="grid gap-1 text-sm">
              <span className="text-muted-foreground">Data</span>
              <input
                type="date"
                value={data}
                onChange={(e) => setData(e.target.value)}
                className="rounded-md border p-2"
              />
            </label>

            {loading ? <p className="text-sm text-muted-foreground">Carregando...</p> : null}
            {error ? <p className="text-sm text-red-600">{error}</p> : null}

            {result && !loading ? (
              <>
                <section className="space-y-2">
                  <h3 className="text-sm font-semibold">
                    Empréstimos criados ({result.emprestimos.length})
                  </h3>
                  {result.emprestimos.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Nenhum empréstimo criado em {formatDateBR(new Date(`${result.data}T12:00:00-04:00`))}.
                    </p>
                  ) : (
                    <div className="overflow-x-auto rounded-md border">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-muted/50 text-left">
                            <th className="p-2">Cliente</th>
                            <th className="p-2">Valor</th>
                            <th className="p-2">Parcelas</th>
                            <th className="p-2">Status</th>
                            <th className="p-2">Horário</th>
                          </tr>
                        </thead>
                        <tbody>
                          {result.emprestimos.map((e) => (
                            <tr key={e.id} className="border-b">
                              <td className="p-2">{e.clienteNome}</td>
                              <td className="p-2">{toCurrency(e.valorEmprestado)}</td>
                              <td className="p-2">
                                {e.numeroParcelas}x de {toCurrency(e.valorParcela)}
                              </td>
                              <td className="p-2">
                                {emprestimoStatusLabel[e.status] ?? e.status}
                              </td>
                              <td className="p-2">{formatTimeBR(e.createdAt)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>

                <section className="space-y-2">
                  <h3 className="text-sm font-semibold">
                    Renovações realizadas ({result.renovacoes.length})
                  </h3>
                  {result.renovacoes.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Nenhuma renovação em {formatDateBR(new Date(`${result.data}T12:00:00-04:00`))}.
                    </p>
                  ) : (
                    <div className="overflow-x-auto rounded-md border">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-muted/50 text-left">
                            <th className="p-2">Cliente</th>
                            <th className="p-2">Carteira</th>
                            <th className="p-2">Caixa</th>
                            <th className="p-2">Parcelas</th>
                            <th className="p-2">Status</th>
                            <th className="p-2">Horário</th>
                          </tr>
                        </thead>
                        <tbody>
                          {result.renovacoes.map((r) => (
                            <tr key={r.id} className="border-b">
                              <td className="p-2">{r.clienteNome}</td>
                              <td className="p-2">{toCurrency(r.valorCarteira)}</td>
                              <td className="p-2">{toCurrency(r.valorCaixa)}</td>
                              <td className="p-2">
                                {r.numeroParcelas}x de {toCurrency(r.valorParcela)}
                              </td>
                              <td className="p-2">
                                {emprestimoStatusLabel[r.status] ?? r.status}
                              </td>
                              <td className="p-2">{formatTimeBR(r.createdAt)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>

                <section className="space-y-2">
                  <h3 className="text-sm font-semibold">
                    Clientes cadastrados ({result.clientes.length})
                  </h3>
                  {result.clientes.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Nenhum cliente cadastrado em {formatDateBR(new Date(`${result.data}T12:00:00-04:00`))}.
                    </p>
                  ) : (
                    <div className="overflow-x-auto rounded-md border">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-muted/50 text-left">
                            <th className="p-2">Nome</th>
                            <th className="p-2">CPF</th>
                            <th className="p-2">WhatsApp</th>
                            <th className="p-2">Horário</th>
                            <th className="p-2 w-[1%] whitespace-nowrap" />
                          </tr>
                        </thead>
                        <tbody>
                          {result.clientes.map((c) => (
                            <tr key={c.id} className="border-b">
                              <td className="p-2">{c.nome}</td>
                              <td className="p-2">{c.cpf}</td>
                              <td className="p-2">{c.whatsapp}</td>
                              <td className="p-2">{formatTimeBR(c.createdAt)}</td>
                              <td className="p-2">
                                <Link
                                  href={`/clientes/${c.id}`}
                                  className="text-primary hover:underline"
                                >
                                  Ver
                                </Link>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              </>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
