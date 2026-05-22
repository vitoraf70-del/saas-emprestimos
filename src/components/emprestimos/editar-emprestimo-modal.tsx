"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatDateMask } from "@/lib/date";
import { toCurrency } from "@/lib/utils";

export type EmprestimoEditSnapshot = {
  id: string;
  clienteNome: string;
  valorEmprestado: number;
  valorParcela: number;
  parcelas: {
    id: string;
    numero_parcela: number;
    status: string;
    valor_original: number;
    vencimento: string;
  }[];
};

type ParcelaForm = {
  id: string;
  numero_parcela: number;
  status: string;
  valor: string;
  vencimento: string;
};

export function EditarEmprestimoModal({
  emprestimoId,
  clienteNome,
  open: controlledOpen,
  onClose
}: {
  emprestimoId: string;
  clienteNome: string;
  open?: boolean;
  onClose?: () => void;
}) {
  const router = useRouter();
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;

  function setOpen(next: boolean) {
    if (!next) onClose?.();
    if (!isControlled) setInternalOpen(next);
  }
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState("");
  const [emprestimo, setEmprestimo] = useState<EmprestimoEditSnapshot | null>(null);
  const [valorEmprestado, setValorEmprestado] = useState("");
  const [parcelasForm, setParcelasForm] = useState<ParcelaForm[]>([]);

  const parcelasPagas = useMemo(
    () => (emprestimo?.parcelas ?? []).filter((p) => p.status === "paga"),
    [emprestimo?.parcelas]
  );

  const parcelasAbertas = useMemo(
    () => (emprestimo?.parcelas ?? []).filter((p) => p.status !== "paga"),
    [emprestimo?.parcelas]
  );

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setFetching(true);
    setError("");

    fetch(`/api/emprestimos/${emprestimoId}`)
      .then(async (response) => {
        const body = (await response.json().catch(() => null)) as
          | EmprestimoEditSnapshot
          | { error?: string }
          | null;
        if (!response.ok) {
          throw new Error(
            body && "error" in body && body.error ? body.error : "Não foi possível carregar o empréstimo."
          );
        }
        return body as EmprestimoEditSnapshot;
      })
      .then((data) => {
        if (cancelled) return;
        setEmprestimo(data);
        setValorEmprestado(String(data.valorEmprestado));
        setParcelasForm(
          data.parcelas
            .filter((p) => p.status !== "paga")
            .map((p) => ({
              id: p.id,
              numero_parcela: p.numero_parcela,
              status: p.status,
              valor: String(Number(p.valor_original)),
              vencimento: p.vencimento
            }))
        );
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Erro ao carregar empréstimo.");
          setEmprestimo(null);
        }
      })
      .finally(() => {
        if (!cancelled) setFetching(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, emprestimoId]);

  function updateParcela(index: number, patch: Partial<ParcelaForm>) {
    setParcelasForm((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!emprestimo) return;

    setLoading(true);
    setError("");

    const valorEmprestadoNum = Number(String(valorEmprestado).replace(",", "."));
    if (!valorEmprestadoNum || valorEmprestadoNum <= 0) {
      setLoading(false);
      setError("Informe o valor emprestado.");
      return;
    }

    const parcelas = parcelasForm.map((p) => ({
      id: p.id,
      valorOriginal: Number(String(p.valor).replace(",", ".")),
      vencimento: p.vencimento
    }));

    const response = await fetch(`/api/emprestimos/${emprestimo.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ valorEmprestado: valorEmprestadoNum, parcelas })
    });

    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    setLoading(false);

    if (!response.ok) {
      setError(body?.error ?? "Não foi possível salvar as alterações.");
      return;
    }

    setOpen(false);
    router.refresh();
  }

  return (
    <>
      {!isControlled ? (
        <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
          Editar
        </Button>
      ) : null}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar empréstimo</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Cliente: <span className="font-medium text-foreground">{clienteNome}</span>
          </p>
          <p className="text-xs text-muted-foreground">
            Ajuste valores ou vencimentos para correção ou renegociação. Parcelas já pagas não podem ser alteradas.
          </p>

          {fetching ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Carregando parcelas...</p>
          ) : emprestimo ? (
            <form onSubmit={onSubmit} className="grid gap-3">
              <label className="grid gap-1 text-sm">
                Valor emprestado (R$)
                <input
                  required
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={valorEmprestado}
                  onChange={(e) => setValorEmprestado(e.target.value)}
                  className="rounded-md border p-2"
                />
              </label>

              {parcelasForm.length > 0 ? (
                <div className="space-y-2 rounded-md border p-3">
                  <p className="text-sm font-medium">Parcelas em aberto</p>
                  {parcelasForm.map((p, index) => (
                    <div key={p.id} className="grid gap-2 rounded-md bg-muted/30 p-2 sm:grid-cols-3">
                      <span className="text-xs font-medium sm:col-span-3">Parcela {p.numero_parcela}</span>
                      <label className="grid gap-1 text-xs">
                        Valor (R$)
                        <input
                          required
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={p.valor}
                          onChange={(e) => updateParcela(index, { valor: e.target.value })}
                          className="rounded-md border p-2 text-sm"
                        />
                      </label>
                      <label className="grid gap-1 text-xs sm:col-span-2">
                        Vencimento
                        <input
                          required
                          value={p.vencimento}
                          onChange={(e) => updateParcela(index, { vencimento: formatDateMask(e.target.value) })}
                          placeholder="DD/MM/AAAA"
                          className="rounded-md border p-2 text-sm"
                        />
                      </label>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
                  Todas as parcelas estão pagas. Só é possível alterar o valor emprestado (histórico).
                </p>
              )}

              {parcelasPagas.length > 0 ? (
                <div className="rounded-md border p-3 text-xs text-muted-foreground">
                  <p className="mb-1 font-medium text-foreground">Parcelas pagas (somente leitura)</p>
                  <ul className="space-y-1">
                    {parcelasPagas.map((p) => (
                      <li key={p.id}>
                        Parcela {p.numero_parcela}: {toCurrency(Number(p.valor_original))} — venc.{" "}
                        {p.vencimento}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {error ? <p className="text-sm text-red-600">{error}</p> : null}

              <div className="flex justify-end gap-2 pt-1">
                <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={loading}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? "Salvando..." : "Salvar alterações"}
                </Button>
              </div>
            </form>
          ) : (
            <p className="text-sm text-red-600">{error || "Não foi possível carregar o empréstimo."}</p>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
