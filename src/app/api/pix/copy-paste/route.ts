import { NextResponse } from "next/server";
import { createPixCharge } from "@/lib/services/pix";
import { prisma } from "@/lib/prisma";
import { calcularParcelaAtualizada, diasAtraso } from "@/lib/finance";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parcelaId = String(body.parcelaId ?? "");
    if (!parcelaId) {
      return NextResponse.json({ error: "Parcela inválida." }, { status: 400 });
    }

    const parcela = await prisma.parcela.findUnique({
      where: { id: parcelaId },
      include: { emprestimo: { include: { cliente: true } } }
    });
    if (!parcela || parcela.status === "paga") {
      return NextResponse.json({ error: "Parcela não encontrada." }, { status: 404 });
    }

    const atraso = diasAtraso(parcela.vencimento);
    const calc = calcularParcelaAtualizada(Number(parcela.valor_original), atraso);
    const updated = await prisma.parcela.update({
      where: { id: parcela.id },
      data: {
        dias_atraso: calc.diasAtraso,
        multa_valor: calc.multaValor,
        juros_valor: calc.jurosValor,
        valor_atualizado: calc.valorAtualizado,
        status: calc.diasAtraso > 0 ? "vencida" : "pendente"
      }
    });

    const pix = await createPixCharge({
      transactionId: `public-${updated.id}-${Date.now()}`,
      amount: Number(updated.valor_atualizado),
      description: `Parcela ${updated.numero_parcela} | pid:${updated.id}`,
      payerName: parcela.emprestimo.cliente.nome,
      payerCpf: parcela.emprestimo.cliente.cpf.replace(/\D/g, "")
    });

    await prisma.pagamento.create({
      data: {
        parcela_id: updated.id,
        valor_pago: updated.valor_atualizado,
        metodo: "pix",
        transaction_id: pix.transactionId,
        status: "pendente"
      }
    });

    return NextResponse.json({
      copyPasteCode: pix.copyPasteCode,
      transactionId: pix.transactionId,
      valorAtualizado: Number(updated.valor_atualizado)
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao gerar PIX.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
