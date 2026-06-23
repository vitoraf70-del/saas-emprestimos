"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatDateWithWeekdayBR } from "@/lib/date";
import { tomorrowCalendarDayKeyBR } from "@/lib/finance";
import { buildInstallmentDueDatesFromDayKey } from "@/lib/parcel-schedule";
import { toCurrency } from "@/lib/utils";

type Frequencia = "diario" | "semanal";

type Props = {
  emprestimoId: string;
  clienteNome: string;
  valorEmprestadoInicial: number;
  valorEmAbertoInicial: number;
  valorParcelaInicial: number;
  numeroParcelasInicial: number;
  open: boolean;
  onClose: () => void;
};

export function RenovarEmprestimoModal({
  emprestimoId,
  clienteNome,
  valorEmprestadoInicial,
  valorEmAbertoInicial,
  valorParcelaInicial,
  numeroParcelasInicial,
  open,
  onClose
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [numeroParcelas, setNumeroParcelas] = useState(numeroParcelasInicial);
  const [valorEmprestado, setValorEmprestado] = useState(
    String(valorEmAbertoInicial || valorEmprestadoInicial)
  );
  const [valorParcela, setValorParcela] = useState(String(valorParcelaInicial));
  const [frequencia, setFrequencia] = useState<Frequencia>("semanal");
  const [primeiroVencimento, setPrimeiroVencimento] = useState(tomorrowCalendarDayKeyBR());

  useEffect(() => {
    if (!open) return;
    const saldoRenovacao = valorEmAbertoInicial || valorEmprestadoInicial;
    setValorEmprestado(String(saldoRenovacao));
    setValorParcela(String(valorParcelaInicial));
    setNumeroParcelas(numeroParcelasInicial);
    setFrequencia("semanal");
    setPrimeiroVencimento(tomorrowCalendarDayKeyBR());
    setError("");
  }, [open, valorEmprestadoInicial, valorEmAbertoInicial, valorParcelaInicial, numeroParcelasInicial]);

  const valorEmprestadoNum = Number(valorEmprestado.replace(",", ".")) || 0;
  const saldoRenovacao = Math.max(valorEmprestadoNum, valorEmAbertoInicial || 0);
  const totalEmprestadoAposRenovacao = valorEmprestadoInicial + saldoRenovacao;
  const valorParcelaNum = Number(valorParcela.replace(",", ".")) || 0;
  const totalAReceber = valorParcelaNum * numeroParcelas;

  const parcelasCalculadas = useMemo(() => {
    if (!primeiroVencimento) return [];
    return buildInstallmentDueDatesFromDayKey(primeiroVencimento, numeroParcelas, frequencia);
  }, [frequencia, numeroParcelas, primeiroVencimento]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const response = await fetch(`/api/emprestimos/${emprestimoId}/renovar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        valorEmprestado: valorEmprestadoNum,
        numeroParcelas,
        valorParcela: valorParcelaNum,
        frequencia,
        primeiroVencimento
      })
    });

    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    setLoading(false);

    if (!response.ok) {
      setError(body?.error ?? "Não foi possível renovar este empréstimo.");
      return;
    }

    onClose();
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Renovar empréstimo</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-3">
          <p className="text-sm text-muted-foreground">
            Cliente: <span className="font-medium text-foreground">{clienteNome}</span>
          </p>

          <label className="grid gap-1 text-sm">
            <span>Valor desta renovação (R$) — saldo em aberto sugerido</span>
            <input
              type="number"
              required
              min={valorEmAbertoInicial || 0.01}
              step={0.01}
              value={valorEmprestado}
              onChange={(e) => setValorEmprestado(e.target.value)}
              className="rounded-md border p-2"
            />
          </label>

          <div className="grid gap-2 sm:grid-cols-2">
            <label className="grid gap-1 text-sm">
              <span>Quantidade de parcelas</span>
              <input
                type="number"
                required
                min={1}
                max={120}
                value={numeroParcelas}
                onChange={(e) => setNumeroParcelas(Math.max(1, Number(e.target.value) || 1))}
                className="rounded-md border p-2"
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span>Valor de cada parcela (R$)</span>
              <input
                type="number"
                required
                min={0.01}
                step={0.01}
                value={valorParcela}
                onChange={(e) => setValorParcela(e.target.value)}
                className="rounded-md border p-2"
              />
            </label>
          </div>

          <label className="grid gap-1 text-sm">
            <span>Frequência das parcelas</span>
            <select
              required
              className="rounded-md border p-2"
              value={frequencia}
              onChange={(e) => setFrequencia(e.target.value as Frequencia)}
            >
              <option value="semanal">Semanal (a cada 7 dias)</option>
              <option value="diario">Diário (segunda a sábado)</option>
            </select>
          </label>

          <label className="grid gap-1 text-sm">
            <span>Primeiro vencimento</span>
            <input
              type="date"
              required
              value={primeiroVencimento}
              onChange={(e) => setPrimeiroVencimento(e.target.value)}
              className="rounded-md border p-2"
            />
          </label>

          <p className="text-xs text-muted-foreground">
            Vencimentos:{" "}
            {parcelasCalculadas.length > 0
              ? parcelasCalculadas.map((data) => formatDateWithWeekdayBR(data)).join(", ")
              : "—"}
          </p>

          <p className="rounded-md border bg-muted/40 p-2 text-sm">
            Já emprestado: <span className="font-semibold">{toCurrency(valorEmprestadoInicial)}</span>
            <br />
            Esta renovação: <span className="font-semibold">{toCurrency(saldoRenovacao)}</span>
            <br />
            Total emprestado após renovar:{" "}
            <span className="font-semibold">{toCurrency(totalEmprestadoAposRenovacao)}</span>
            <br />
            {numeroParcelas}x de <span className="font-semibold">{toCurrency(valorParcelaNum)}</span>
            <br />
            Total a receber nas novas parcelas:{" "}
            <span className="font-semibold">{toCurrency(totalAReceber)}</span>
          </p>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading || valorEmprestadoNum <= 0 || valorParcelaNum <= 0}>
              {loading ? "Renovando..." : "Confirmar renovação"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
