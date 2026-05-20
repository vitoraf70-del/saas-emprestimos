import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncEmprestimoStatus } from "@/lib/emprestimo-status";
import { sendWhatsAppMessage } from "@/lib/services/whatsapp";
import { toCurrency } from "@/lib/utils";

export async function POST(request: Request) {
  const formData = await request.formData();
  const parcelaId = String(formData.get("parcelaId"));
  const transactionId = String(formData.get("transactionId"));

  const parcela = await prisma.parcela.findUnique({
    where: { id: parcelaId },
    include: {
      emprestimo: { include: { cliente: true } }
    }
  });
  if (!parcela) return NextResponse.json({ error: "Parcela não encontrada" }, { status: 404 });

  await prisma.$transaction(async (tx) => {
    await tx.pagamento.create({
      data: {
        parcela_id: parcela.id,
        valor_pago: parcela.valor_atualizado,
        metodo: "pix",
        transaction_id: transactionId,
        status: "confirmado"
      }
    });
    await tx.parcela.update({
      where: { id: parcela.id },
      data: {
        status: "paga",
        data_pagamento: new Date(),
        valor_atualizado: parcela.valor_atualizado
      }
    });
    await syncEmprestimoStatus(parcela.emprestimo_id, tx);
  });

  await sendWhatsAppMessage({
    phone: parcela.emprestimo.cliente.whatsapp,
    message: `Pagamento confirmado com sucesso. Valor recebido: ${toCurrency(Number(parcela.valor_atualizado))}.`
  });

  return NextResponse.redirect(new URL(`/pagar?paid=1`, request.url));
}
