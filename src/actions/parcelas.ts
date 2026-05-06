"use server";

import { prisma } from "@/lib/prisma";
import { calcularParcelaAtualizada, diasAtraso } from "@/lib/finance";

export async function recalculateParcela(parcelaId: string) {
  const parcela = await prisma.parcela.findUnique({
    where: { id: parcelaId },
    include: { emprestimo: true }
  });
  if (!parcela) throw new Error("Parcela não encontrada");

  const dias = diasAtraso(parcela.vencimento);
  const result = calcularParcelaAtualizada(Number(parcela.valor_original), dias);

  return prisma.parcela.update({
    where: { id: parcelaId },
    data: {
      dias_atraso: result.diasAtraso,
      multa_valor: result.multaValor,
      juros_valor: result.jurosValor,
      valor_atualizado: result.valorAtualizado,
      status: result.diasAtraso > 0 && parcela.status !== "paga" ? "vencida" : parcela.status
    }
  });
}
