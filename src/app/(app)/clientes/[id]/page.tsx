import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { recalculateParcela } from "@/actions/parcelas";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EditarClienteModal } from "@/components/clientes/editar-cliente-modal";
import { ExcluirClienteButton } from "@/components/clientes/excluir-cliente-button";
import { sendWhatsAppMessage } from "@/lib/services/whatsapp";
import { formatDateBR } from "@/lib/date";
import { calcularParcelaComIsencao, diasAtraso } from "@/lib/finance";
import { buildPagarLink, buildPagarLinkWithCpf, formatLinkPagamentoWhatsApp } from "@/lib/app-url";
import { labelOcupacao } from "@/lib/ocupacao";
import { toCurrency } from "@/lib/utils";
import { prisma } from "@/lib/prisma";

const parcelaStatusLabel: Record<string, string> = {
  pendente: "Pendente",
  vencida: "Vencida",
  paga: "Paga"
};

export default async function ClienteDetalhePage({
  params,
  searchParams
}: {
  params: { id: string };
  searchParams: { wa?: string; waError?: string };
}) {
  const clienteId = params.id;
  const cliente = await prisma.cliente.findUnique({
    where: { id: clienteId },
    include: { emprestimos: { include: { parcelas: true } } }
  });
  if (!cliente) return notFound();

  const updates = cliente.emprestimos.flatMap((emprestimo) =>
    emprestimo.parcelas.flatMap((parcela) => {
      if (parcela.status === "paga") return [];
        const dias = diasAtraso(new Date(parcela.vencimento));
        const calc = calcularParcelaComIsencao(
          Number(parcela.valor_original),
          dias,
          emprestimo.frequencia_parcela,
          parcela.encargos_isentos
        );
        const novoStatus = calc.diasAtraso > 0 ? "vencida" : "pendente";
        const mudou =
          Number(parcela.dias_atraso) !== calc.diasAtraso ||
          Number(parcela.multa_valor) !== calc.multaValor ||
          Number(parcela.juros_valor) !== calc.jurosValor ||
          Number(parcela.valor_atualizado) !== calc.valorAtualizado ||
          parcela.status !== novoStatus;

        if (!mudou) return [];

        return [
          prisma.parcela.updateMany({
            where: { id: parcela.id, status: { in: ["pendente", "vencida"] } },
            data: {
              dias_atraso: calc.diasAtraso,
              multa_valor: calc.multaValor,
              juros_valor: calc.jurosValor,
              valor_atualizado: calc.valorAtualizado,
              status: novoStatus
            }
          })
        ];
      })
  );

  if (updates.length > 0) {
    await Promise.all(updates);
  }

  const parcelas = cliente.emprestimos
    .flatMap((e) => e.parcelas.map((p) => ({ ...p, emprestimo: e })))
    .map((parcela) => {
      if (parcela.status === "paga") return parcela;
      const dias = diasAtraso(new Date(parcela.vencimento));
      const calc = calcularParcelaComIsencao(
        Number(parcela.valor_original),
        dias,
        parcela.emprestimo.frequencia_parcela,
        parcela.encargos_isentos
      );
      return {
        ...parcela,
        dias_atraso: calc.diasAtraso,
        multa_valor: calc.multaValor,
        juros_valor: calc.jurosValor,
        valor_atualizado: calc.valorAtualizado,
        status: calc.diasAtraso > 0 ? "vencida" : "pendente"
      };
    })
    .sort((a, b) => new Date(a.vencimento).getTime() - new Date(b.vencimento).getTime());
  const totalPago = parcelas.filter((p) => p.status === "paga").reduce((acc, p) => acc + Number(p.valor_atualizado), 0);
  const saldoRestante = parcelas.filter((p) => p.status !== "paga").reduce((acc, p) => acc + Number(p.valor_atualizado), 0);
  const jurosAcumulado = parcelas.reduce((acc, p) => acc + Number(p.juros_valor), 0);
  const valorEmprestado = cliente.emprestimos.reduce((acc, e) => acc + Number(e.valor_emprestado), 0);

  async function cobrarAction() {
    "use server";
    try {
      const clienteAtual = await prisma.cliente.findUnique({
        where: { id: clienteId },
        include: { emprestimos: { include: { parcelas: true } } }
      });
      if (!clienteAtual) {
        throw new Error("Cliente não encontrado.");
      }

      const atrasadas = clienteAtual.emprestimos
        .flatMap((emprestimo) => emprestimo.parcelas)
        .filter((parcela) => parcela.status !== "paga");
      if (!atrasadas[0]) {
        throw new Error("Nenhuma parcela em aberto.");
      }

      const atualizada = await recalculateParcela(atrasadas[0].id);
      const link = buildPagarLink();
      await sendWhatsAppMessage({
        phone: clienteAtual.whatsapp,
        message: `Olá ${clienteAtual.nome}, sua parcela está em aberto. Valor atualizado: ${toCurrency(
          Number(atualizada.valor_atualizado)
        )}.${formatLinkPagamentoWhatsApp(link)}`
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao enviar WhatsApp.";
      redirect(`/clientes/${clienteId}?wa=error&waError=${encodeURIComponent(message)}`);
    }

    redirect(`/clientes/${clienteId}?wa=sent`);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">{cliente.nome}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            CPF {cliente.cpf} · {cliente.whatsapp}
            {cliente.tipo_ocupacao
              ? ` · ${labelOcupacao(cliente.tipo_ocupacao, cliente.ocupacao_detalhe)}`
              : ""}
            {cliente.origem_cadastro === "whatsapp" ? " · Cadastro via WhatsApp" : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <EditarClienteModal cliente={cliente} />
          <ExcluirClienteButton
            id={cliente.id}
            nome={cliente.nome}
            emprestimosCount={cliente.emprestimos.length}
            aposExcluirHref="/clientes"
            size="default"
          />
        </div>
      </div>
      {searchParams.wa === "sent" ? (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          Mensagem enviada no WhatsApp com sucesso.
        </p>
      ) : null}
      {searchParams.wa === "error" ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          Erro ao enviar WhatsApp: {searchParams.waError ?? "erro desconhecido."}
        </p>
      ) : null}
      <div className="grid gap-4 md:grid-cols-3">
        <Card><CardHeader><CardTitle>Valor emprestado</CardTitle></CardHeader><CardContent>{toCurrency(valorEmprestado)}</CardContent></Card>
        <Card><CardHeader><CardTitle>Saldo restante</CardTitle></CardHeader><CardContent>{toCurrency(saldoRestante)}</CardContent></Card>
        <Card><CardHeader><CardTitle>Total pago</CardTitle></CardHeader><CardContent>{toCurrency(totalPago)}</CardContent></Card>
        <Card><CardHeader><CardTitle>Parcelas pagas</CardTitle></CardHeader><CardContent>{parcelas.filter((p) => p.status === "paga").length}</CardContent></Card>
        <Card><CardHeader><CardTitle>Pendentes</CardTitle></CardHeader><CardContent>{parcelas.filter((p) => p.status === "pendente").length}</CardContent></Card>
        <Card><CardHeader><CardTitle>Vencidas</CardTitle></CardHeader><CardContent>{parcelas.filter((p) => p.status === "vencida").length}</CardContent></Card>
        <Card><CardHeader><CardTitle>Juros acumulado</CardTitle></CardHeader><CardContent>{toCurrency(jurosAcumulado)}</CardContent></Card>
      </div>
      <div className="flex flex-wrap gap-2">
        <form action={cobrarAction}>
          <Button type="submit">Cobrar no WhatsApp</Button>
        </form>
        <Button asChild variant="outline">
          <Link href={buildPagarLinkWithCpf(cliente.cpf)} target="_blank">
            Abrir página de pagamento
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Parcelas</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-left">
                <th className="p-3">Parcela</th>
                <th className="p-3">Vencimento</th>
                <th className="p-3">Valor</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {parcelas.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-6 text-center text-muted-foreground">
                    Nenhuma parcela cadastrada para este cliente.
                  </td>
                </tr>
              ) : (
                parcelas.map((parcela) => (
                  <tr key={parcela.id} className="border-b">
                    <td className="p-3">{parcela.numero_parcela}</td>
                    <td className="p-3">{formatDateBR(new Date(parcela.vencimento))}</td>
                    <td className="p-3">
                      {toCurrency(Number(parcela.valor_atualizado || parcela.valor_original))}
                    </td>
                    <td className="p-3">{parcelaStatusLabel[parcela.status] ?? parcela.status}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
