"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { JUROS_DIA_FIXO, MULTA_ATRASO_FIXA } from "@/lib/finance";
import { buildInstallmentDueDates } from "@/lib/parcel-schedule";
import { toCurrency } from "@/lib/utils";

type ClienteOption = {
  id: string;
  nome: string;
  cpf: string;
};

type Frequencia = "diario" | "semanal";

export function NovoEmprestimoPersonalizadoModal({ clientes }: { clientes: ClienteOption[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [numeroParcelas, setNumeroParcelas] = useState(4);
  const [valorEmprestado, setValorEmprestado] = useState("500");
  const [valorParcela, setValorParcela] = useState("200");
  const [frequencia, setFrequencia] = useState<Frequencia>("semanal");
  const [primeiroVencimento, setPrimeiroVencimento] = useState("");

  const valorEmprestadoNum = Number(valorEmprestado.replace(",", ".")) || 0;
  const valorParcelaNum = Number(valorParcela.replace(",", ".")) || 0;
  const totalAReceber = valorParcelaNum * numeroParcelas;
  const lucroPrevisto = totalAReceber - valorEmprestadoNum;

  const parcelasCalculadas = useMemo(() => {
    if (!primeiroVencimento) return [];
    const dataBase = new Date(`${primeiroVencimento}T12:00:00`);
    if (Number.isNaN(dataBase.getTime())) return [];
    return buildInstallmentDueDates(dataBase, numeroParcelas, frequencia);
  }, [numeroParcelas, primeiroVencimento, frequencia]);

  const parcelasCalculadasISO = parcelasCalculadas.map((data) => format(data, "yyyy-MM-dd"));
  const parcelasResumo = parcelasCalculadas.map((data) => format(data, "dd/MM (EEE)", { locale: ptBR }));

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
      primeiroVencimento: String(data.get("primeiroVencimento") ?? ""),
      parcelasVencimentos: parcelasCalculadasISO
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
    setPrimeiroVencimento("");
    setOpen(false);
    form.reset();
    router.refresh();
  }

  return (
    <>
      <Button type="button" variant="outline" onClick={() => setOpen(true)}>
        Empréstimo personalizado
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Empréstimo personalizado</DialogTitle>
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

            <input
              type="date"
              required
              name="primeiroVencimento"
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
              Vencimento diário: segunda a sábado (domingo não entra na grade de cobrança).
              Em atraso, multa de {toCurrency(MULTA_ATRASO_FIXA)} + {toCurrency(JUROS_DIA_FIXO)} por dia
              corre inclusive aos domingos.
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
