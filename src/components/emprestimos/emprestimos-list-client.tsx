"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EditarEmprestimoModal } from "@/components/emprestimos/editar-emprestimo-modal";
import { RenovarEmprestimoModal } from "@/components/emprestimos/renovar-emprestimo-modal";
import { formatDateBR } from "@/lib/date";
import type { EmprestimoListRow } from "@/lib/queries/emprestimos-list";
import { EMPRESTIMOS_PAGE_SIZE } from "@/lib/queries/emprestimos-list";
import { toCurrency } from "@/lib/utils";

const emprestimoStatusLabel: Record<string, string> = {
  ativo: "Ativo",
  quitado: "Quitado",
  inadimplente: "Inadimplente"
};

type Props = {
  emprestimos: EmprestimoListRow[];
  total: number;
  currentPage: number;
  totalPages: number;
  filters: { nome?: string; status?: string };
};

function buildPageHref(base: { nome?: string; status?: string }, page: number) {
  const params = new URLSearchParams();
  if (base.nome) params.set("nome", base.nome);
  if (base.status) params.set("status", base.status);
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `/emprestimos?${qs}` : "/emprestimos";
}

export function EmprestimosListClient({
  emprestimos,
  total,
  currentPage,
  totalPages,
  filters
}: Props) {
  const [editTarget, setEditTarget] = useState<{ id: string; nome: string } | null>(null);
  const [renewTarget, setRenewTarget] = useState<{
    id: string;
    nome: string;
    valorEmprestado: number;
    valorParcela: number;
    numeroParcelas: number;
  } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    nome: string;
    valorLabel: string;
  } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  async function confirmarExclusao() {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError("");

    const response = await fetch(`/api/emprestimos/${deleteTarget.id}`, { method: "DELETE" });
    setDeleting(false);

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setDeleteError(body?.error ?? "Não foi possível excluir o empréstimo.");
      return;
    }

    setDeleteTarget(null);
    window.location.reload();
  }

  return (
    <>
      <Card>
        <CardContent className="p-4">
        <form className="mb-4 grid gap-2 md:grid-cols-4" method="get" action="/emprestimos">
          <input
            name="nome"
            placeholder="Buscar por cliente"
            defaultValue={filters.nome ?? ""}
            className="rounded-md border p-2"
          />
          <select name="status" defaultValue={filters.status ?? ""} className="rounded-md border p-2">
            <option value="">Status</option>
            <option value="ativo">Ativo</option>
            <option value="quitado">Quitado</option>
            <option value="inadimplente">Inadimplente</option>
          </select>
          <button
            type="submit"
            className="rounded-md bg-primary p-2 text-primary-foreground md:col-span-2"
          >
            Filtrar
          </button>
        </form>

        <p className="mb-3 text-sm text-muted-foreground">
          {total} empréstimo(s) — página {currentPage} de {totalPages} (até {EMPRESTIMOS_PAGE_SIZE}{" "}
          por página)
        </p>

        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50 text-left">
              <th className="p-3">Cliente</th>
              <th className="p-3">Emprestado</th>
              <th className="p-3">Em aberto</th>
              <th className="p-3">Parcelas</th>
              <th className="p-3">Próx. vencimento</th>
              <th className="p-3">Status</th>
              <th className="p-3 w-[1%] whitespace-nowrap text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {emprestimos.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-6 text-center text-muted-foreground">
                  Nenhum empréstimo encontrado.
                </td>
              </tr>
            ) : (
              emprestimos.map((e) => (
                <tr key={e.id} className="border-b">
                  <td className="p-3">{e.clienteNome}</td>
                  <td className="p-3">{toCurrency(e.valorEmprestado)}</td>
                  <td className="p-3">{toCurrency(e.emAberto)}</td>
                  <td className="p-3">
                    {e.parcelasPagas}/{e.numeroParcelas} pagas
                  </td>
                  <td className="p-3">
                    {e.proximoVencimento ? formatDateBR(e.proximoVencimento) : "—"}
                  </td>
                  <td className="p-3">{emprestimoStatusLabel[e.status] ?? e.status}</td>
                  <td className="p-3 text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setRenewTarget({
                            id: e.id,
                            nome: e.clienteNome,
                            valorEmprestado: e.valorEmprestado,
                            valorParcela: e.valorParcela,
                            numeroParcelas: e.numeroParcelas
                          })
                        }
                      >
                        Renovar
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setEditTarget({ id: e.id, nome: e.clienteNome })}
                      >
                        Editar
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
                        onClick={() =>
                          setDeleteTarget({
                            id: e.id,
                            nome: e.clienteNome,
                            valorLabel: toCurrency(e.valorEmprestado)
                          })
                        }
                      >
                        Excluir
                      </Button>
                    </div>
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

      {editTarget ? (
        <EditarEmprestimoModal
          emprestimoId={editTarget.id}
          clienteNome={editTarget.nome}
          open
          onClose={() => setEditTarget(null)}
        />
      ) : null}

      {renewTarget ? (
        <RenovarEmprestimoModal
          emprestimoId={renewTarget.id}
          clienteNome={renewTarget.nome}
          valorEmprestadoInicial={renewTarget.valorEmprestado}
          valorParcelaInicial={renewTarget.valorParcela}
          numeroParcelasInicial={renewTarget.numeroParcelas}
          open
          onClose={() => setRenewTarget(null)}
        />
      ) : null}

      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(next) => {
          if (!next) {
            setDeleteTarget(null);
            setDeleteError("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir empréstimo</DialogTitle>
          </DialogHeader>
          {deleteTarget ? (
            <>
              <p className="text-sm text-muted-foreground">
                Cliente: <span className="font-medium text-foreground">{deleteTarget.nome}</span>
                <br />
                Valor: <span className="font-medium text-foreground">{deleteTarget.valorLabel}</span>
              </p>
              <p className="text-sm text-muted-foreground">
                Serão removidos permanentemente este contrato, todas as parcelas e pagamentos PIX
                associados.
              </p>
              {deleteError ? <p className="text-sm text-red-600">{deleteError}</p> : null}
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDeleteTarget(null)}
                  disabled={deleting}
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  className="bg-red-600 text-white hover:bg-red-700"
                  onClick={confirmarExclusao}
                  disabled={deleting}
                >
                  {deleting ? "Excluindo..." : "Excluir definitivamente"}
                </Button>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
