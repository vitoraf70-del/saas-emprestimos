import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const toNumber = (value: Prisma.Decimal | number | null | undefined) =>
  Number(value ?? 0);

export async function getDashboardData() {
  const [emprestimos, pagamentos, parcelas, clientes] = await Promise.all([
    prisma.emprestimo.findMany({ include: { parcelas: true } }),
    prisma.pagamento.findMany(),
    prisma.parcela.findMany({ include: { emprestimo: true } }),
    prisma.cliente.count()
  ]);

  const totalEmprestado = emprestimos.reduce((acc, item) => acc + toNumber(item.valor_emprestado), 0);
  const totalRecebido = pagamentos.reduce((acc, item) => acc + toNumber(item.valor_pago), 0);
  const totalAReceber = parcelas
    .filter((p) => p.status !== "paga")
    .reduce((acc, item) => acc + toNumber(item.valor_atualizado || item.valor_original), 0);
  const lucroTotal = totalRecebido - totalEmprestado;
  const lucroPercentual = totalEmprestado ? (lucroTotal / totalEmprestado) * 100 : 0;

  const parcelasVencidas = parcelas.filter((p) => p.status === "vencida").length;
  const valorEmAtraso = parcelas
    .filter((p) => p.status === "vencida")
    .reduce((acc, p) => acc + toNumber(p.valor_atualizado), 0);

  const inadimplenciaPercentual = parcelas.length ? (parcelasVencidas / parcelas.length) * 100 : 0;

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
