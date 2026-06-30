import Image from "next/image";
import { notFound } from "next/navigation";
import { gerarPixComRegistro } from "@/lib/services/pix-gerar";
import { toCurrency } from "@/lib/utils";
import { recalculateParcela } from "@/actions/parcelas";
import { prisma } from "@/lib/prisma";

export default async function CobrancaPage({ params }: { params: { cpf: string } }) {
  const cliente = await prisma.cliente.findUnique({
    where: { cpf: params.cpf },
    include: {
      emprestimos: {
        include: {
          parcelas: { where: { status: { in: ["pendente", "vencida"] } }, orderBy: { vencimento: "asc" } }
        }
      }
    }
  });

  if (!cliente) return notFound();
  const parcela = cliente.emprestimos.flatMap((e) => e.parcelas)[0];
  if (!parcela) return notFound();

  const atualizada = await recalculateParcela(parcela.id);
  const pix = await gerarPixComRegistro({
    seed: `parcela-${parcela.id}-${Date.now()}`,
    parcelaId: parcela.id,
    amount: Number(atualizada.valor_atualizado),
    description: `Parcela ${parcela.numero_parcela} | pid:${parcela.id}`,
    payerName: cliente.nome,
    payerCpf: cliente.cpf
  });

  return (
    <div className="mx-auto max-w-xl space-y-4 p-6">
      <h1 className="text-2xl font-bold">Cobrança PIX</h1>
      <div className="rounded-xl border bg-white p-4 space-y-2">
        <p><b>Nome:</b> {cliente.nome}</p>
        <p><b>CPF:</b> {cliente.cpf}</p>
        <p><b>Parcela:</b> {parcela.numero_parcela}</p>
        <p><b>Dias de atraso:</b> {atualizada.dias_atraso}</p>
        <p><b>Valor original:</b> {toCurrency(Number(parcela.valor_original))}</p>
        <p><b>Multa:</b> {toCurrency(Number(atualizada.multa_valor))}</p>
        <p><b>Juros:</b> {toCurrency(Number(atualizada.juros_valor))}</p>
        <p><b>Valor atualizado:</b> {toCurrency(Number(atualizada.valor_atualizado))}</p>
      </div>
      {pix.qrCodeBase64 ? (
        <Image
          alt="QR Code PIX"
          src={`data:image/png;base64,${pix.qrCodeBase64}`}
          width={240}
          height={240}
        />
      ) : null}
      <textarea className="w-full rounded-md border p-2 text-xs" rows={4} readOnly value={pix.copyPasteCode} />
      <form action={`/api/pix/confirm`} method="POST" className="space-y-2">
        <input type="hidden" name="parcelaId" value={parcela.id} />
        <input type="hidden" name="transactionId" value={pix.transactionId} />
        <button className="w-full rounded-md bg-primary p-2 text-primary-foreground">Já paguei</button>
      </form>
    </div>
  );
}
