import { calcularParcelaComIsencao, diasAtraso } from "@/lib/finance";
import { syncEmprestimoStatus } from "@/lib/emprestimo-status";
import { prisma } from "@/lib/prisma";

export async function recalculateOpenParcelasData() {
  const hoje = new Date();
  const parcelas = await prisma.parcela.findMany({
    where: { status: { in: ["pendente", "vencida"] } },
    select: {
      id: true,
      status: true,
      valor_original: true,
      vencimento: true,
      emprestimo_id: true,
      emprestimo: { select: { frequencia_parcela: true } },
      dias_atraso: true,
      multa_valor: true,
      juros_valor: true,
      valor_atualizado: true,
      encargos_isentos: true
    }
  });

  await Promise.all(
    parcelas.map((parcela) => {
      const dias = diasAtraso(parcela.vencimento, hoje);
      const result = calcularParcelaComIsencao(
        Number(parcela.valor_original),
        dias,
        parcela.emprestimo.frequencia_parcela,
        parcela.encargos_isentos
      );
      const novoStatus = result.diasAtraso > 0 ? "vencida" : "pendente";
      const mudou =
        Number(parcela.dias_atraso) !== result.diasAtraso ||
        Number(parcela.multa_valor) !== result.multaValor ||
        Number(parcela.juros_valor) !== result.jurosValor ||
        Number(parcela.valor_atualizado) !== result.valorAtualizado ||
        parcela.status !== novoStatus;

      if (!mudou) return Promise.resolve(null);

      return prisma.parcela.updateMany({
        where: { id: parcela.id, status: { in: ["pendente", "vencida"] } },
        data: {
          dias_atraso: result.diasAtraso,
          multa_valor: result.multaValor,
          juros_valor: result.jurosValor,
          valor_atualizado: result.valorAtualizado,
          status: novoStatus
        }
      });
    })
  );

  const emprestimoIds = await prisma.emprestimo.findMany({ select: { id: true } });
  await Promise.all(emprestimoIds.map(({ id }) => syncEmprestimoStatus(id)));
}
