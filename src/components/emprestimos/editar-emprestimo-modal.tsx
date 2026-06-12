"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatDateBR, formatDateMask, parseDateFromInput } from "@/lib/date";
import { addCalendarDays } from "@/lib/finance";
import type { FrequenciaParcela } from "@/lib/parcel-schedule";
import { toCurrency } from "@/lib/utils";

export type EmprestimoEditSnapshot = {
  id: string;
  clienteNome: string;
  valorEmprestado: number;
  valorParcela: number;
  frequenciaParcela: FrequenciaParcela;
  parcelas: {
    id: string;
    numero_parcela: number;
    status: string;
    valor_original: number;
    vencimento: string;
  }[];
};

type ParcelaForm = {
  id?: string;
  numero_parcela: number;
  status: string;
  valor: string;
  vencimento: string;
  isNew?: boolean;
};

let nextTempId = 0;
function newTempId() {
  nextTempId += 1;
  return `new-${nextTempId}`;
}

function suggestNextVencimento(lastVencimento: string, frequencia: FrequenciaParcela) {
  const parsed = parseDateFromInput(lastVencimento);
  if (!parsed) return "";
  const days = frequencia === "diario" ? 1 : 7;
  return formatDateBR(addCalendarDays(parsed, days));
}

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

  const totalEmAberto = useMemo(
    () =>
      parcelasForm.reduce((acc, p) => {
        const valor = Number(String(p.valor).replace(",", "."));
        return acc + (Number.isFinite(valor) ? valor : 0);
      }, 0),
    [parcelasForm]
  );

  function mapParcelasAbertas(data: EmprestimoEditSnapshot) {
    return data.parcelas
      .filter((p) => p.status !== "paga")
      .map((p) => ({
        id: p.id,
        numero_parcela: p.numero_parcela,
        status: p.status,
        valor: String(Number(p.valor_original)),
        vencimento: p.vencimento
      }));
  }

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
        setParcelasForm(mapParcelasAbertas(data));
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

  function adicionarParcela() {
    if (!emprestimo) return;

    const ultima = parcelasForm[parcelasForm.length - 1];
    const proximoNumero =
      parcelasForm.length > 0
        ? Math.max(...parcelasForm.map((p) => p.numero_parcela)) + 1
        : parcelasPagas.length > 0
          ? Math.max(...parcelasPagas.map((p) => p.numero_parcela)) + 1
          : 1;

    setParcelasForm((prev) => [
      ...prev,
      {
        id: newTempId(),
        numero_parcela: proximoNumero,
        status: "pendente",
        valor: ultima?.valor ?? String(emprestimo.valorParcela),
        vencimento: ultima
          ? suggestNextVencimento(ultima.vencimento, emprestimo.frequenciaParcela)
          : "",
        isNew: true
      }
    ]);
  }

  function adicionarParcelaJuros() {
    if (!emprestimo) return;

    const ultima = parcelasForm[parcelasForm.length - 1];
    const proximoNumero =
      parcelasForm.length > 0
        ? Math.max(...parcelasForm.map((p) => p.numero_parcela)) + 1
        : parcelasPagas.length > 0
          ? Math.max(...parcelasPagas.map((p) => p.numero_parcela)) + 1
          : 1;

    setParcelasForm((prev) => [
      ...prev,
      {
        id: newTempId(),
        numero_parcela: proximoNumero,
        status: "pendente",
        valor: "",
        vencimento: ultima
          ? suggestNextVencimento(ultima.vencimento, emprestimo.frequenciaParcela)
          : "",
        isNew: true
      }
    ]);
  }

  function removerParcela(index: number) {
    setParcelasForm((prev) => prev.filter((_, i) => i !== index));
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

    if (parcelasForm.length === 0 && parcelasPagas.length < emprestimo.parcelas.length) {
      setLoading(false);
      setError("Mantenha ao menos uma parcela em aberto ou marque todas como pagas.");
      return;
    }

    const parcelas = parcelasForm.map((p) => ({
      id: p.isNew ? undefined : p.id,
      valorOriginal: Number(String(p.valor).replace(",", ".")),
      vencimento: p.vencimento
    }));

    for (let i = 0; i < parcelas.length; i++) {
      if (!parcelas[i].valorOriginal || parcelas[i].valorOriginal <= 0) {
        setLoading(false);
        setError(`Informe o valor da parcela ${i + 1}.`);
        return;
      }
      if (!parseDateFromInput(parcelas[i].vencimento)) {
        setLoading(false);
        setError(`Vencimento inválido na parcela ${i + 1}. Use DD/MM/AAAA.`);
        return;
      }
    }

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
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar empréstimo</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Cliente: <span className="font-medium text-foreground">{clienteNome}</span>
          </p>
          <p className="text-xs text-muted-foreground">
            Renegocie valores, datas e quantidade de parcelas. Parcelas pagas não podem ser alteradas.
            Use &quot;Parcela de juros&quot; para jogar encargos no final.
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
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium">Parcelas em aberto ({parcelasForm.length})</p>
                    <p className="text-sm text-muted-foreground">
                      Total em aberto: <span className="font-semibold text-foreground">{toCurrency(totalEmAberto)}</span>
                    </p>
                  </div>

                  {parcelasForm.map((p, index) => (
                    <div key={p.id ?? `parcela-${index}`} className="grid gap-2 rounded-md bg-muted/30 p-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium">
                          {p.isNew ? "Nova parcela" : `Parcela ${p.numero_parcela}`}
                          {p.status === "vencida" ? (
                            <span className="ml-2 text-red-600">(vencida)</span>
                          ) : null}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-red-600 hover:text-red-700"
                          onClick={() => removerParcela(index)}
                        >
                          Remover
                        </Button>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
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
                        <label className="grid gap-1 text-xs">
                          Vencimento
                          <input
                            required
                            value={p.vencimento}
                            onChange={(e) =>
                              updateParcela(index, { vencimento: formatDateMask(e.target.value) })
                            }
                            placeholder="DD/MM/AAAA"
                            className="rounded-md border p-2 text-sm"
                          />
                        </label>
                      </div>
                    </div>
                  ))}

                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button type="button" variant="outline" size="sm" onClick={adicionarParcela}>
                      + Adicionar parcela
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={adicionarParcelaJuros}>
                      + Parcela de juros
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2 rounded-md border border-amber-200 bg-amber-50 p-3">
                  <p className="text-xs text-amber-900">
                    Todas as parcelas estão pagas. Só é possível alterar o valor emprestado (histórico).
                  </p>
                  <Button type="button" variant="outline" size="sm" onClick={adicionarParcela}>
                    + Adicionar parcela (renegociar)
                  </Button>
                </div>
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
