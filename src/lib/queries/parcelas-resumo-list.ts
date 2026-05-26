import { Prisma, StatusParcela } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const PARCELAS_RESUMO_PAGE_SIZE = 25;

const toNumber = (value: Prisma.Decimal | number | null | undefined) =>
  Number(value ?? 0);

export type ParcelasResumoRow = {
  emprestimoId: string;
  clienteId: string;
  clienteNome: string;
  numeroParcelas: number;
  parcelasPagas: number;
  parcelasVencidas: number;
  emAberto: number;
  proximoVencimento: Date | null;
  situacao: "vencida" | "pendente" | "em_dia" | "quitado";
};

export type ParcelasResumoFilters = {
  page?: number;
  nome?: string;
  cpf?: string;
  status?: StatusParcela;
};

function buildWhere(filters: ParcelasResumoFilters): Prisma.EmprestimoWhereInput {
  const nome = filters.nome?.trim();
  const cpf = filters.cpf?.trim();

  return {
    cliente: {
      nome: nome ? { contains: nome, mode: "insensitive" } : undefined,
      cpf: cpf ? { contains: cpf } : undefined
    },
    parcelas: filters.status ? { some: { status: filters.status } } : undefined
  };
}

function situacaoFromStats(pagas: number, total: number, vencidas: number): ParcelasResumoRow["situacao"] {
  if (pagas >= total && total > 0) return "quitado";
  if (vencidas > 0) return "vencida";
  if (pagas < total) return "pendente";
  return "em_dia";
}

const situacaoLabel: Record<ParcelasResumoRow["situacao"], string> = {
  vencida: "Vencida",
  pendente: "Pendente",
  em_dia: "Em dia",
  quitado: "Quitado"
};

export function labelSituacaoParcelas(situacao: ParcelasResumoRow["situacao"]) {
  return situacaoLabel[situacao];
}

function sortByProximoVencimento<T extends { proximoVencimento: Date | null }>(rows: T[]) {
  return [...rows].sort((a, b) => {
    if (!a.proximoVencimento && !b.proximoVencimento) return 0;
    if (!a.proximoVencimento) return 1;
    if (!b.proximoVencimento) return -1;
    return a.proximoVencimento.getTime() - b.proximoVencimento.getTime();
  });
}

export async function getParcelasResumoList(filters: ParcelasResumoFilters = {}) {
  const page = Math.max(1, filters.page ?? 1);
  const where = buildWhere(filters);
  const skip = (page - 1) * PARCELAS_RESUMO_PAGE_SIZE;

  const [emprestimos, total] = await Promise.all([
    prisma.emprestimo.findMany({
      where,
      select: {
        id: true,
        numero_parcelas: true,
        cliente_id: true,
        cliente: { select: { nome: true } }
      }
    }),
    prisma.emprestimo.count({ where })
  ]);

  const ids = emprestimos.map((e) => e.id);

  if (ids.length === 0) {
    return {
      rows: [] as ParcelasResumoRow[],
      total,
      page,
      pageSize: PARCELAS_RESUMO_PAGE_SIZE,
      totalPages: Math.max(1, Math.ceil(total / PARCELAS_RESUMO_PAGE_SIZE))
    };
  }

  const [parcelaStats, proximosVencimentos] = await Promise.all([
    prisma.parcela.groupBy({
      by: ["emprestimo_id", "status"],
      where: { emprestimo_id: { in: ids } },
      _count: { id: true },
      _sum: { valor_atualizado: true, valor_original: true }
    }),
    prisma.$queryRaw<{ emprestimo_id: string; prox_vencimento: Date }[]>`
      SELECT emprestimo_id, MIN(vencimento) AS prox_vencimento
      FROM "Parcela"
      WHERE status::text IN ('pendente', 'vencida')
        AND emprestimo_id IN (${Prisma.join(ids)})
      GROUP BY emprestimo_id
    `
  ]);

  const proximoPorEmprestimo = new Map(
    proximosVencimentos.map((row) => [row.emprestimo_id, row.prox_vencimento])
  );

  const statsPorEmprestimo = new Map<
    string,
    { pagas: number; vencidas: number; emAberto: number }
  >();

  for (const row of parcelaStats) {
    const current = statsPorEmprestimo.get(row.emprestimo_id) ?? {
      pagas: 0,
      vencidas: 0,
      emAberto: 0
    };
    if (row.status === "paga") {
      current.pagas += row._count.id;
    } else if (row.status === "vencida") {
      current.vencidas += row._count.id;
      current.emAberto +=
        toNumber(row._sum.valor_atualizado) || toNumber(row._sum.valor_original);
    } else {
      current.emAberto +=
        toNumber(row._sum.valor_atualizado) || toNumber(row._sum.valor_original);
    }
    statsPorEmprestimo.set(row.emprestimo_id, current);
  }

  const allRows: ParcelasResumoRow[] = emprestimos.map((e) => {
    const stats = statsPorEmprestimo.get(e.id) ?? { pagas: 0, vencidas: 0, emAberto: 0 };
    return {
      emprestimoId: e.id,
      clienteId: e.cliente_id,
      clienteNome: e.cliente.nome,
      numeroParcelas: e.numero_parcelas,
      parcelasPagas: stats.pagas,
      parcelasVencidas: stats.vencidas,
      emAberto: stats.emAberto,
      proximoVencimento: proximoPorEmprestimo.get(e.id) ?? null,
      situacao: situacaoFromStats(stats.pagas, e.numero_parcelas, stats.vencidas)
    };
  });

  const rows = sortByProximoVencimento(allRows).slice(skip, skip + PARCELAS_RESUMO_PAGE_SIZE);

  return {
    rows,
    total,
    page,
    pageSize: PARCELAS_RESUMO_PAGE_SIZE,
    totalPages: Math.max(1, Math.ceil(total / PARCELAS_RESUMO_PAGE_SIZE))
  };
}
