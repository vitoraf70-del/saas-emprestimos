import { prisma } from "@/lib/prisma";
import { syncEmprestimoStatus } from "@/lib/emprestimo-status";

/** Corrige parcelas com pagamento confirmado mas status ainda em aberto (race no recálculo). */
export async function repararParcelasComPagamentoConfirmado() {
  const inconsistentes = await prisma.parcela.findMany({
    where: {
      status: { in: ["pendente", "vencida"] },
      OR: [{ data_pagamento: { not: null } }, { pagamentos: { some: { status: "confirmado" } } }]
    },
    include: {
      pagamentos: {
        where: { status: "confirmado" },
        orderBy: { data_pagamento: "desc" },
        take: 1
      }
    }
  });

  const emprestimoIds = new Set<string>();

  for (const parcela of inconsistentes) {
    const pagamento = parcela.pagamentos[0];
    const valorPago = pagamento
      ? Number(pagamento.valor_pago)
      : Number(parcela.valor_atualizado) || Number(parcela.valor_original);

    await prisma.parcela.update({
      where: { id: parcela.id },
      data: {
        status: "paga",
        data_pagamento: parcela.data_pagamento ?? pagamento?.data_pagamento ?? new Date(),
        dias_atraso: 0,
        multa_valor: 0,
        juros_valor: 0,
        valor_atualizado: valorPago
      }
    });
    emprestimoIds.add(parcela.emprestimo_id);
  }

  for (const emprestimoId of emprestimoIds) {
    await syncEmprestimoStatus(emprestimoId);
  }

  return { reparadas: inconsistentes.length };
}
