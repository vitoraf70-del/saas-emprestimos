"use server";

import { prisma } from "@/lib/prisma";
import { calcularParcelaComIsencao, diasAtraso } from "@/lib/finance";
import { syncEmprestimoStatus } from "@/lib/emprestimo-status";
import { recalculateOpenParcelasData } from "@/lib/services/parcelas-recalculo";

export async function recalculateParcela(parcelaId: string) {
  const parcela = await prisma.parcela.findUnique({
    where: { id: parcelaId },
    include: { emprestimo: true }
  });
  if (!parcela) throw new Error("Parcela não encontrada");

  const dias = diasAtraso(parcela.vencimento);
  const result = calcularParcelaComIsencao(
    Number(parcela.valor_original),
    dias,
    parcela.emprestimo.frequencia_parcela,
    parcela.encargos_isentos,
    parcela.juros_isentos
  );

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
  await recalculateOpenParcelasData();
}
