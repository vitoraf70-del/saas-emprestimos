"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatDateWithWeekdayBR } from "@/lib/date";
import { buildDespesaVencimentos, splitValorEmParcelas } from "@/lib/despesa-schedule";
import { tomorrowCalendarDayKeyBR } from "@/lib/finance";
import { toCurrency } from "@/lib/utils";

export function NovaDespesaModal() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [parcelado, setParcelado] = useState(false);
  const [numeroParcelas, setNumeroParcelas] = useState(2);
  const [primeiroVencimento, setPrimeiroVencimento] = useState(tomorrowCalendarDayKeyBR);
  const [valorTotal, setValorTotal] = useState("");

  const valorNumerico = Number(String(valorTotal).replace(",", ".")) || 0;
  const parcelasPreview = useMemo(() => {
    if (!primeiroVencimento || valorNumerico <= 0) return [];
    const qtd = parcelado ? numeroParcelas : 1;
    const vencimentos = buildDespesaVencimentos(primeiroVencimento, qtd);
    const valores = splitValorEmParcelas(valorNumerico, qtd);
    return vencimentos.map((data, i) => ({
      numero: i + 1,
      valor: valores[i],
      data
    }));
  }, [parcelado, numeroParcelas, primeiroVencimento, valorNumerico]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const form = event.currentTarget;
    const data = new FormData(form);
    const payload = {
      descricao: String(data.get("descricao") ?? ""),
      valorTotal: valorNumerico,
      parcelado,
      numeroParcelas: parcelado ? numeroParcelas : 1,
      primeiroVencimento
    };

    try {
      const response = await fetch("/api/despesas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(body?.error ?? "Não foi possível salvar a despesa.");
        return;
      }

      setOpen(false);
      setParcelado(false);
      setNumeroParcelas(2);
      setValorTotal("");
      setPrimeiroVencimento(tomorrowCalendarDayKeyBR());
      form.reset();
      router.refresh();
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        onClick={() => {
          setPrimeiroVencimento(tomorrowCalendarDayKeyBR());
          setOpen(true);
        }}
      >
        Nova despesa
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Cadastrar despesa</DialogTitle>
          </DialogHeader>

          <form onSubmit={onSubmit} className="grid gap-3">
            <input required name="descricao" placeholder="Descrição (ex.: Aluguel, Internet)" className="rounded-md border p-2" />
            <input
              required
              name="valorTotal"
              type="number"
              min="0.01"
              step="0.01"
              placeholder="Valor total (R$)"
              className="rounded-md border p-2"
              value={valorTotal}
              onChange={(e) => setValorTotal(e.target.value)}
            />

            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={parcelado} onChange={(e) => setParcelado(e.target.checked)} />
              Parcelado
            </label>

            {parcelado ? (
              <input
                required
                type="number"
                min={2}
                max={60}
                value={numeroParcelas}
                onChange={(e) => setNumeroParcelas(Math.max(2, Number(e.target.value) || 2))}
                placeholder="Quantas vezes"
                className="rounded-md border p-2"
              />
            ) : null}

            <label className="grid gap-1 text-sm">
              <span>Data do 1º vencimento</span>
              <input
                required
                type="date"
                className="rounded-md border p-2"
                value={primeiroVencimento}
                onChange={(e) => setPrimeiroVencimento(e.target.value)}
              />
            </label>

            {parcelasPreview.length > 0 ? (
              <DespesaParcelasPreview parcelas={parcelasPreview} parcelado={parcelado} />
            ) : null}

            {error ? (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}

            <Button type="submit" disabled={loading}>
              {loading ? "Salvando..." : "Salvar despesa"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function DespesaParcelasPreview({
  parcelas,
  parcelado
}: {
  parcelas: { numero: number; valor: number; data: Date }[];
  parcelado: boolean;
}) {
  return (
    <div className="rounded-md border bg-muted/30 p-3 text-sm">
      <p className="mb-2 font-medium">{parcelado ? "Parcelas mensais" : "Pagamento à vista"}</p>
      <ul className="max-h-40 space-y-1 overflow-y-auto">
        {parcelas.map((p) => (
          <li key={p.numero}>
            {parcelado ? `${p.numero}ª` : "Única"} — {toCurrency(p.valor)} — {formatDateWithWeekdayBR(p.data)}
          </li>
        ))}
      </ul>
    </div>
  );
}
