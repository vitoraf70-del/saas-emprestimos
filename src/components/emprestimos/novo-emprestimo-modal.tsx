"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { addDays, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LOAN_AMOUNTS, LOAN_INSTALLMENTS, LOAN_PLANS } from "@/lib/loan-plans";
import { toCurrency } from "@/lib/utils";

type ClienteOption = {
  id: string;
  nome: string;
  cpf: string;
};

export function NovoEmprestimoModal({ clientes }: { clientes: ClienteOption[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [valorSelecionado, setValorSelecionado] = useState<number>(500);
  const [parcelasSelecionadas, setParcelasSelecionadas] = useState<number>(4);
  const [primeiroVencimento, setPrimeiroVencimento] = useState("");

  const valorParcela = LOAN_PLANS[valorSelecionado as 500 | 700 | 1000][parcelasSelecionadas as 4 | 6 | 8];
  const totalFinal = valorParcela * parcelasSelecionadas;
  const parcelasCalculadas = useMemo(() => {
    if (!primeiroVencimento) return [];
    const dataBase = new Date(`${primeiroVencimento}T12:00:00`);
    if (Number.isNaN(dataBase.getTime())) return [];
    return Array.from({ length: parcelasSelecionadas }, (_, index) => addDays(dataBase, index * 7));
  }, [parcelasSelecionadas, primeiroVencimento]);
  const parcelasCalculadasISO = parcelasCalculadas.map((data) => format(data, "yyyy-MM-dd"));
  const parcelasResumo = parcelasCalculadas.map((data) => format(data, "dd/MM (EEE)", { locale: ptBR }));

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    const form = event.currentTarget;

    const data = new FormData(form);
    const payload = {
      clienteId: String(data.get("clienteId") ?? ""),
      valor: Number(data.get("valor") ?? 0),
      numeroParcelas: Number(data.get("numeroParcelas") ?? 0),
      primeiroVencimento: String(data.get("primeiroVencimento") ?? ""),
      parcelasVencimentos: parcelasCalculadasISO
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
    setPrimeiroVencimento("");
    setOpen(false);
    form.reset();
    router.refresh();
  }

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}>
        Novo empréstimo
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Empréstimo</DialogTitle>
          </DialogHeader>
          <form onSubmit={onSubmit} className="grid gap-3">
            <select required name="clienteId" className="rounded-md border p-2">
              <option value="">Selecione um cliente</option>
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

            <input
              type="date"
              required
              name="primeiroVencimento"
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
