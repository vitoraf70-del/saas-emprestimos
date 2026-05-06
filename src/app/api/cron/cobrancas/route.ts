import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { diasAtraso, calcularParcelaAtualizada } from "@/lib/finance";
import { sendWhatsAppMessage } from "@/lib/services/whatsapp";
import { toCurrency } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET() {
  if (process.env.CRON_SECRET) {
    // Vercel cron can call this endpoint with the secret in query/header if desired.
  }

  const pendentes = await prisma.parcela.findMany({
    where: { status: { in: ["pendente", "vencida"] } },
    include: { emprestimo: { include: { cliente: true } } }
  });

  for (const parcela of pendentes) {
    const dias = diasAtraso(parcela.vencimento);
    const calc = calcularParcelaAtualizada(Number(parcela.valor_original), dias);
    await prisma.parcela.update({
      where: { id: parcela.id },
      data: {
        dias_atraso: calc.diasAtraso,
        multa_valor: calc.multaValor,
        juros_valor: calc.jurosValor,
        valor_atualizado: calc.valorAtualizado,
        status: calc.diasAtraso > 0 ? "vencida" : "pendente"
      }
    });

    const publicPaymentUrl = `${process.env.NEXT_PUBLIC_APP_URL}/pagar`;
    const vencimentoHoje = dias === 0;
    const reminder = "Regularize o mais rápido possível sua dívida para evitar acumular mais juros.";
    const msg = vencimentoHoje
      ? `Olá ${parcela.emprestimo.cliente.nome}, sua parcela vence hoje no valor de ${toCurrency(
          Number(calc.valorAtualizado)
        )}. Clique para pagar via PIX: ${publicPaymentUrl}. Abra o link e digite seu CPF para ver as parcelas e pagar. ${reminder}`
      : `Olá ${parcela.emprestimo.cliente.nome}, sua parcela está atrasada há ${dias} dias. Valor atualizado: ${toCurrency(
          Number(calc.valorAtualizado)
        )}. Pague no link: ${publicPaymentUrl}. Abra o link e digite seu CPF para ver as parcelas e pagar. ${reminder}`;

    await sendWhatsAppMessage({
      phone: parcela.emprestimo.cliente.whatsapp,
      message: msg
    });
  }

  return NextResponse.json({ ok: true, processed: pendentes.length });
}
