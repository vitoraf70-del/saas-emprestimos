"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatDateWithWeekdayBR } from "@/lib/date";
import { tomorrowCalendarDayKeyBR } from "@/lib/finance";
import { LOAN_AMOUNTS, LOAN_INSTALLMENTS, LOAN_PLANS } from "@/lib/loan-plans";
import { buildInstallmentDueDatesFromDayKey } from "@/lib/parcel-schedule";
import { toCurrency } from "@/lib/utils";
import { useClientesOptions } from "@/components/emprestimos/use-clientes-options";

export function NovoEmprestimoModal() {
  const router = useRouter();
  const { clientes, loading: loadingClientes, load: loadClientes } = useClientesOptions();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) void loadClientes();
  }, [open, loadClientes]);
  const [valorSelecionado, setValorSelecionado] = useState<number>(500);
  const [parcelasSelecionadas, setParcelasSelecionadas] = useState<number>(4);
  const [primeiroVencimento, setPrimeiroVencimento] = useState(tomorrowCalendarDayKeyBR);

  const valorParcela = LOAN_PLANS[valorSelecionado as 500 | 700 | 1000][parcelasSelecionadas as 4 | 6 | 8];
  const totalFinal = valorParcela * parcelasSelecionadas;
  const parcelasCalculadas = useMemo(() => {
    if (!primeiroVencimento) return [];
    return buildInstallmentDueDatesFromDayKey(primeiroVencimento, parcelasSelecionadas, "semanal");
  }, [parcelasSelecionadas, primeiroVencimento]);
  const parcelasResumo = parcelasCalculadas.map((data) => formatDateWithWeekdayBR(data));

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    const form = event.currentTarget;

    const data = new FormData(form);
    const payload = {
      clienteId: String(data.get("clienteId") ?? ""),
      valor: Number(data.get("valor") ?? 0),
      numeroParcelas: Number(data.get("numeroParcelas") ?? 0),
      primeiroVencimento: primeiroVencimento
    };

    const response = await fetch("/api/emprestimos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    setLoading(false);
    if (!response.ok) return;

    setValorSelecionado(500);
    setParcelasSelecionadas(4);
    setPrimeiroVencimento(tomorrowCalendarDayKeyBR());
    setOpen(false);
    form.reset();
    router.refresh();
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
        Novo empréstimo
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Empréstimo</DialogTitle>
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
            <select
              required
              name="valor"
              className="rounded-md border p-2"
              value={valorSelecionado}
              onChange={(e) => setValorSelecionado(Number(e.target.value))}
            >
              {LOAN_AMOUNTS.map((valor) => (
                <option key={valor} value={valor}>
                  {`Empréstimo de ${toCurrency(valor)}`}
                </option>
              ))}
            </select>
            <select
              required
              name="numeroParcelas"
              className="rounded-md border p-2"
              value={parcelasSelecionadas}
              onChange={(e) => setParcelasSelecionadas(Number(e.target.value))}
            >
              {LOAN_INSTALLMENTS.map((parcelas) => (
                <option key={parcelas} value={parcelas}>
                  {`${parcelas}x de ${toCurrency(LOAN_PLANS[valorSelecionado as 500 | 700 | 1000][parcelas])}`}
                </option>
              ))}
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
              Parcelas: {parcelasResumo.length > 0 ? parcelasResumo.join(", ") : "-"}
            </p>

            <p className="text-xs text-muted-foreground">
              Parcelas semanais automáticas no mesmo dia da semana do primeiro vencimento.
            </p>
            <p className="text-xs text-muted-foreground">
              Plano selecionado: {parcelasSelecionadas}x de {toCurrency(valorParcela)}
            </p>
            <p className="rounded-md border bg-muted/40 p-2 text-sm">
              Total final a pagar: <span className="font-semibold">{toCurrency(totalFinal)}</span>
            </p>
            <Button type="submit" disabled={loading}>
              {loading ? "Salvando..." : "Salvar empréstimo"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
