import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const DESPESAS_PAGE_SIZE = 25;

const toNumber = (value: Prisma.Decimal | number | null | undefined) => Number(value ?? 0);

export type DespesaListRow = {
  id: string;
  descricao: string;
  valorTotal: number;
  parcelado: boolean;
  numeroParcelas: number;
  parcelasPagas: number;
  emAberto: number;
  proximoVencimento: Date | null;
  createdAt: Date;
};

export type DespesaParcelaRow = {
  id: string;
  despesaId: string;
  descricao: string;
  numeroParcela: number;
  valor: number;
  vencimento: Date;
  status: string;
  dataPagamento: Date | null;
};

export async function getDespesasList(page = 1) {
  const skip = (Math.max(1, page) - 1) * DESPESAS_PAGE_SIZE;

  const [despesas, total] = await Promise.all([
    prisma.despesa.findMany({
      orderBy: { created_at: "desc" },
      take: DESPESAS_PAGE_SIZE,
      skip,
      select: {
        id: true,
        descricao: true,
        valor_total: true,
        parcelado: true,
        numero_parcelas: true,
        created_at: true
      }
    }),
    prisma.despesa.count()
  ]);

  const ids = despesas.map((d) => d.id);
  if (ids.length === 0) {
    return {
      rows: [] as DespesaListRow[],
      total,
      page,
      totalPages: Math.max(1, Math.ceil(total / DESPESAS_PAGE_SIZE))
    };
  }

  const stats = await prisma.despesaParcela.groupBy({
    by: ["despesa_id", "status"],
    where: { despesa_id: { in: ids } },
    _count: { id: true },
    _sum: { valor: true }
  });

  const proximos = await prisma.$queryRaw<{ despesa_id: string; prox_vencimento: Date }[]>`
    SELECT despesa_id, MIN(vencimento) AS prox_vencimento
    FROM "DespesaParcela"
    WHERE status::text = 'pendente'
      AND despesa_id IN (${Prisma.join(ids)})
    GROUP BY despesa_id
  `;

  const proximoMap = new Map(proximos.map((r) => [r.despesa_id, r.prox_vencimento]));
  const statsMap = new Map<string, { pagas: number; emAberto: number }>();

  for (const row of stats) {
    const current = statsMap.get(row.despesa_id) ?? { pagas: 0, emAberto: 0 };
    if (row.status === "paga") {
      current.pagas += row._count.id;
    } else {
      current.emAberto += toNumber(row._sum.valor);
    }
    statsMap.set(row.despesa_id, current);
  }

  const rows: DespesaListRow[] = despesas.map((d) => {
    const s = statsMap.get(d.id) ?? { pagas: 0, emAberto: 0 };
    return {
      id: d.id,
      descricao: d.descricao,
      valorTotal: toNumber(d.valor_total),
      parcelado: d.parcelado,
      numeroParcelas: d.numero_parcelas,
      parcelasPagas: s.pagas,
      emAberto: s.emAberto,
      proximoVencimento: proximoMap.get(d.id) ?? null,
      createdAt: d.created_at
    };
  });

  return {
    rows,
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / DESPESAS_PAGE_SIZE))
  };
}

export async function getDespesaParcelas(despesaIds?: string | string[]) {
  const ids = despesaIds ? (Array.isArray(despesaIds) ? despesaIds : [despesaIds]) : undefined;
  const parcelas = await prisma.despesaParcela.findMany({
    where: ids?.length ? { despesa_id: { in: ids } } : undefined,
    orderBy: [{ vencimento: "asc" }, { numero_parcela: "asc" }],
    include: { despesa: { select: { descricao: true } } },
    take: ids?.length ? undefined : 100
  });

  return parcelas.map(
    (p): DespesaParcelaRow => ({
      id: p.id,
      despesaId: p.despesa_id,
      descricao: p.despesa.descricao,
      numeroParcela: p.numero_parcela,
      valor: toNumber(p.valor),
      vencimento: p.vencimento,
      status: p.status,
      dataPagamento: p.data_pagamento
    })
  );
}
