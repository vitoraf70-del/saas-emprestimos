import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getGestaoCaixaData } from "@/lib/services/movimentacao-caixa";

const MESES_CURTOS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const CHART_MONTHS = 6;

const toNumber = (value: Prisma.Decimal | number | bigint | null | undefined) =>
  Number(value ?? 0);

export type MonthlyChartPoint = {
  mes: string;
  recebimentos: number;
  lucro: number;
  atraso: number;
};

function monthKey(date: Date) {
  return `${date.getUTCFullYear()}-${date.getUTCMonth()}`;
}

function buildMonthBuckets(count: number) {
  const now = new Date();
  const buckets: { key: string; label: string; start: Date }[] = [];

  for (let i = count - 1; i >= 0; i--) {
    const start = new Date(Date.UTC(now.getFullYear(), now.getMonth() - i, 1));
    buckets.push({
      key: monthKey(start),
      label: MESES_CURTOS[start.getUTCMonth()],
      start
    });
  }

  return buckets;
}

async function getMonthlyChartData(): Promise<MonthlyChartPoint[]> {
  const buckets = buildMonthBuckets(CHART_MONTHS);
  const rangeStart = buckets[0]?.start ?? new Date();

  const [recebimentosRows, emprestadoRows, atrasoRows] = await Promise.all([
    prisma.$queryRaw<{ mes: Date; total: Prisma.Decimal }[]>`
      SELECT date_trunc('month', data_pagamento) AS mes, SUM(valor_atualizado) AS total
      FROM "Parcela"
      WHERE status = 'paga'
        AND data_pagamento IS NOT NULL
        AND data_pagamento >= ${rangeStart}
      GROUP BY 1
    `,
    prisma.$queryRaw<{ mes: Date; total: Prisma.Decimal }[]>`
      SELECT date_trunc('month', data_inicio) AS mes, SUM(valor_emprestado) AS total
      FROM "Emprestimo"
      WHERE data_inicio >= ${rangeStart}
      GROUP BY 1
    `,
    prisma.$queryRaw<{ mes: Date; vencidas: bigint; total: bigint }[]>`
      SELECT date_trunc('month', vencimento) AS mes,
        COUNT(*) FILTER (WHERE status = 'vencida') AS vencidas,
        COUNT(*) AS total
      FROM "Parcela"
      WHERE vencimento >= ${rangeStart}
      GROUP BY 1
    `
  ]);

  const recebimentosMap = new Map(recebimentosRows.map((row) => [monthKey(row.mes), toNumber(row.total)]));
  const emprestadoMap = new Map(emprestadoRows.map((row) => [monthKey(row.mes), toNumber(row.total)]));
  const atrasoMap = new Map(
    atrasoRows.map((row) => {
      const total = toNumber(row.total);
      const vencidas = toNumber(row.vencidas);
      return [monthKey(row.mes), total ? (vencidas / total) * 100 : 0];
    })
  );

  return buckets.map((bucket) => {
    const recebimentos = recebimentosMap.get(bucket.key) ?? 0;
    const emprestado = emprestadoMap.get(bucket.key) ?? 0;

    return {
      mes: bucket.label,
      recebimentos,
      lucro: recebimentos - emprestado,
      atraso: Number((atrasoMap.get(bucket.key) ?? 0).toFixed(1))
    };
  });
}

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

  const monthly = await getMonthlyChartData();
  const caixa = await getGestaoCaixaData();

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
    },
    caixa,
    charts: {
      monthly
    }
  };
}
