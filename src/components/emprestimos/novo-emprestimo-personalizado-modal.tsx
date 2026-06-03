"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatDateWithWeekdayBR } from "@/lib/date";
import {
  JUROS_DIA_DIARIO,
  JUROS_DIA_SEMANAL,
  MULTA_ATRASO_SEMANAL,
  tomorrowCalendarDayKeyBR
} from "@/lib/finance";
import { buildInstallmentDueDatesFromDayKey } from "@/lib/parcel-schedule";
import { toCurrency } from "@/lib/utils";
import { useClientesOptions } from "@/components/emprestimos/use-clientes-options";

type Frequencia = "diario" | "semanal";

export function NovoEmprestimoPersonalizadoModal() {
  const router = useRouter();
  const { clientes, loading: loadingClientes, load: loadClientes } = useClientesOptions();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) void loadClientes();
  }, [open, loadClientes]);
  const [error, setError] = useState("");
  const [numeroParcelas, setNumeroParcelas] = useState(4);
  const [valorEmprestado, setValorEmprestado] = useState("500");
  const [valorParcela, setValorParcela] = useState("200");
  const [frequencia, setFrequencia] = useState<Frequencia>("semanal");
  const [primeiroVencimento, setPrimeiroVencimento] = useState(tomorrowCalendarDayKeyBR);

  const valorEmprestadoNum = Number(valorEmprestado.replace(",", ".")) || 0;
  const valorParcelaNum = Number(valorParcela.replace(",", ".")) || 0;
  const totalAReceber = valorParcelaNum * numeroParcelas;
  const lucroPrevisto = totalAReceber - valorEmprestadoNum;

  const parcelasCalculadas = useMemo(() => {
    if (!primeiroVencimento) return [];
    return buildInstallmentDueDatesFromDayKey(primeiroVencimento, numeroParcelas, frequencia);
  }, [numeroParcelas, primeiroVencimento, frequencia]);

  const parcelasResumo = parcelasCalculadas.map((data) => formatDateWithWeekdayBR(data));

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const form = event.currentTarget;
    const data = new FormData(form);
    const payload = {
      clienteId: String(data.get("clienteId") ?? ""),
      valorEmprestado: Number(String(data.get("valorEmprestado") ?? "").replace(",", ".")),
      numeroParcelas: Number(data.get("numeroParcelas") ?? 0),
      valorParcela: Number(String(data.get("valorParcela") ?? "").replace(",", ".")),
      frequencia: String(data.get("frequencia") ?? "semanal"),
      primeiroVencimento: primeiroVencimento
    };

    const response = await fetch("/api/emprestimos/personalizado", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    setLoading(false);

    if (!response.ok) {
      setError(body?.error ?? "Não foi possível salvar o empréstimo.");
      return;
    }

    setNumeroParcelas(4);
    setValorEmprestado("500");
    setValorParcela("200");
    setFrequencia("semanal");
    setPrimeiroVencimento(tomorrowCalendarDayKeyBR());
    setOpen(false);
    form.reset();
    router.refresh();
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={() => {
          setPrimeiroVencimento(tomorrowCalendarDayKeyBR());
          setOpen(true);
        }}
      >
        Empréstimo personalizado
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Empréstimo personalizado</DialogTitle>
          </DialogHeader>
          <form onSubmit={onSubmit} className="grid gap-3">
            <select
              required
              name="clienteId"
              className="rounded-md border p-2"
              disabled={loadingClientes}
            >
              <option value="">
                {loadingClientes ? "Carregando clientes..." : "Selecione um cliente"}
              </option>
              {clientes.map((cliente) => (
                <option key={cliente.id} value={cliente.id}>
                  {cliente.nome} - {cliente.cpf}
                </option>
              ))}
            </select>

            <label className="grid gap-1 text-sm">
              <span>Valor emprestado ao cliente (R$)</span>
              <input
                type="number"
                required
                min={0.01}
                step={0.01}
                name="valorEmprestado"
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
                  name="numeroParcelas"
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
                  name="valorParcela"
                  value={valorParcela}
                  onChange={(e) => setValorParcela(e.target.value)}
                  className="rounded-md border p-2"
                />
              </label>
            </div>

            <select
              required
              name="frequencia"
              className="rounded-md border p-2"
              value={frequencia}
              onChange={(e) => setFrequencia(e.target.value as Frequencia)}
            >
              <option value="semanal">Semanal (a cada 7 dias)</option>
              <option value="diario">Diário (segunda a sábado, sem domingo)</option>
            </select>

            <input type="hidden" name="primeiroVencimento" value={primeiroVencimento} readOnly />
            <input
              type="date"
              required
              value={primeiroVencimento}
              onChange={(e) => setPrimeiroVencimento(e.target.value)}
              className="rounded-md border p-2"
            />

            <p className="text-xs text-muted-foreground">
              Vencimentos: {parcelasResumo.length > 0 ? parcelasResumo.join(", ") : "—"}
            </p>

            <p className="rounded-md border bg-muted/40 p-2 text-sm">
              Emprestado: <span className="font-semibold">{toCurrency(valorEmprestadoNum)}</span>
              <br />
              {numeroParcelas}x de <span className="font-semibold">{toCurrency(valorParcelaNum)}</span> ({frequencia})
              <br />
              Total a receber: <span className="font-semibold">{toCurrency(totalAReceber)}</span>
              <br />
              Lucro previsto: <span className="font-semibold">{toCurrency(lucroPrevisto)}</span>
            </p>

            <p className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
              {frequencia === "diario" ? (
                <>
                  Vencimento diário: segunda a sábado (domingo não entra na grade de cobrança). Em atraso,{" "}
                  {toCurrency(JUROS_DIA_DIARIO)} por dia (ex.: 2 dias = {toCurrency(JUROS_DIA_DIARIO * 2)}).
                  Juros continuam correndo inclusive aos domingos.
                </>
              ) : (
                <>
                  Em atraso, multa de {toCurrency(MULTA_ATRASO_SEMANAL)} + {toCurrency(JUROS_DIA_SEMANAL)} por dia
                  de juros.
                </>
              )}
            </p>

            {error ? <p className="text-sm text-red-600">{error}</p> : null}

            <Button type="submit" disabled={loading || valorEmprestadoNum <= 0 || valorParcelaNum <= 0}>
              {loading ? "Salvando..." : "Salvar empréstimo personalizado"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
