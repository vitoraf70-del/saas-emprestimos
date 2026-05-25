import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const toNumber = (value: Prisma.Decimal | number | null | undefined) =>
  Number(value ?? 0);

export async function getDashboardData() {
  const [
    emprestadoAgg,
    recebidoParcelasAgg,
    aReceberAgg,
    parcelasVencidas,
    atrasoAgg,
    parcelasPorStatus,
    clientes
  ] = await Promise.all([
    prisma.emprestimo.aggregate({ _sum: { valor_emprestado: true } }),
    prisma.parcela.aggregate({
      where: { status: "paga" },
      _sum: { valor_atualizado: true }
    }),
    prisma.parcela.aggregate({
      where: { status: { not: "paga" } },
      _sum: { valor_atualizado: true }
    }),
    prisma.parcela.count({ where: { status: "vencida" } }),
    prisma.parcela.aggregate({
      where: { status: "vencida" },
      _sum: { valor_atualizado: true }
    }),
    prisma.parcela.groupBy({
      by: ["status"],
      _count: { id: true }
    }),
    prisma.cliente.count()
  ]);

  const totalEmprestado = toNumber(emprestadoAgg._sum.valor_emprestado);
  const totalRecebido = toNumber(recebidoParcelasAgg._sum.valor_atualizado);
  const totalAReceber = toNumber(aReceberAgg._sum.valor_atualizado);
  const lucroTotal = totalRecebido - totalEmprestado;
  const lucroPercentual = totalEmprestado ? (lucroTotal / totalEmprestado) * 100 : 0;
  const valorEmAtraso = toNumber(atrasoAgg._sum.valor_atualizado);

  const totalParcelas = parcelasPorStatus.reduce((acc, row) => acc + row._count.id, 0);
  const inadimplenciaPercentual = totalParcelas ? (parcelasVencidas / totalParcelas) * 100 : 0;

  return {
    cards: {
      totalEmprestado,
      totalRecebido,
      totalAReceber,
      lucroTotal,
      lucroPercentual,
      inadimplenciaPercentual,
      parcelasVencidas,
      valorEmAtraso,
      clientesAtivos: clientes
    }
  };
}
