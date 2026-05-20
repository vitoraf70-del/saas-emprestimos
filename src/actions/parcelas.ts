"use server";

import { prisma } from "@/lib/prisma";
import { calcularParcelaAtualizada, diasAtraso } from "@/lib/finance";
import { syncEmprestimoStatus } from "@/lib/emprestimo-status";

export async function recalculateParcela(parcelaId: string) {
  const parcela = await prisma.parcela.findUnique({
    where: { id: parcelaId },
    include: { emprestimo: true }
  });
  if (!parcela) throw new Error("Parcela não encontrada");

  const dias = diasAtraso(parcela.vencimento);
  const result = calcularParcelaAtualizada(Number(parcela.valor_original), dias);

  const updated = await prisma.parcela.update({
    where: { id: parcelaId },
    data: {
      dias_atraso: result.diasAtraso,
      multa_valor: result.multaValor,
      juros_valor: result.jurosValor,
      valor_atualizado: result.valorAtualizado,
      status:
        parcela.status === "paga" ? "paga" : result.diasAtraso > 0 ? "vencida" : "pendente"
    }
  });

  await syncEmprestimoStatus(parcela.emprestimo_id);
  return updated;
}

export async function recalculateOpenParcelas() {
  const parcelas = await prisma.parcela.findMany({
    where: { status: { in: ["pendente", "vencida"] } },
    select: { id: true }
  });

  for (const parcela of parcelas) {
    await recalculateParcela(parcela.id);
  }

  const emprestimoIds = await prisma.emprestimo.findMany({ select: { id: true } });
  for (const { id } of emprestimoIds) {
    await syncEmprestimoStatus(id);
  }
}
