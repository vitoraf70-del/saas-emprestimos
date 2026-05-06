import { notFound, redirect } from "next/navigation";
import { recalculateParcela } from "@/actions/parcelas";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EditarClienteModal } from "@/components/clientes/editar-cliente-modal";
import { sendWhatsAppMessage } from "@/lib/services/whatsapp";
import { toCurrency } from "@/lib/utils";
import { prisma } from "@/lib/prisma";

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

  const parcelas = cliente.emprestimos.flatMap((e) => e.parcelas);
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
      const link = `${process.env.NEXT_PUBLIC_APP_URL}/pagar`;
      await sendWhatsAppMessage({
        phone: clienteAtual.whatsapp,
        message: `Olá ${clienteAtual.nome}, sua parcela está em aberto. Valor atualizado: ${toCurrency(
          Number(atualizada.valor_atualizado)
        )}. Abra o link e digite seu CPF para ver as parcelas e pagar: ${link}

Regularize o mais rápido possível sua dívida para evitar acumular mais juros.`
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao enviar WhatsApp.";
      redirect(`/clientes/${clienteId}?wa=error&waError=${encodeURIComponent(message)}`);
    }

    redirect(`/clientes/${clienteId}?wa=sent`);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-2xl font-bold">{cliente.nome}</h2>
        <EditarClienteModal cliente={cliente} />
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
      <form action={cobrarAction}>
        <Button type="submit">Cobrar no WhatsApp</Button>
      </form>
    </div>
  );
}
