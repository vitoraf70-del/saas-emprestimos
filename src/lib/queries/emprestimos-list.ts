import { Prisma, StatusEmprestimo } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const EMPRESTIMOS_PAGE_SIZE = 25;

const toNumber = (value: Prisma.Decimal | number | null | undefined) =>
  Number(value ?? 0);

export type EmprestimoListRow = {
  id: string;
  valorEmprestado: number;
  valorPrincipalBase: number;
  valorParcela: number;
  numeroParcelas: number;
  status: string;
  clienteNome: string;
  emAberto: number;
  parcelasPagas: number;
  proximoVencimento: Date | null;
};

export type EmprestimosListFilters = {
  page?: number;
  nome?: string;
  status?: StatusEmprestimo;
};

function sortByProximoVencimento<T extends { proximoVencimento: Date | null }>(rows: T[]) {
  return [...rows].sort((a, b) => {
    if (!a.proximoVencimento && !b.proximoVencimento) return 0;
    if (!a.proximoVencimento) return 1;
    if (!b.proximoVencimento) return -1;
    return a.proximoVencimento.getTime() - b.proximoVencimento.getTime();
  });
}

function buildWhere(filters: EmprestimosListFilters): Prisma.EmprestimoWhereInput {
  const nome = filters.nome?.trim();

  return {
    status: filters.status || undefined,
    cliente: nome ? { nome: { contains: nome, mode: "insensitive" } } : undefined
  };
}

export async function getEmprestimosList(filters: EmprestimosListFilters = {}) {
  const page = Math.max(1, filters.page ?? 1);
  const where = buildWhere(filters);
  const skip = (page - 1) * EMPRESTIMOS_PAGE_SIZE;

  const [emprestimos, total] = await Promise.all([
    prisma.emprestimo.findMany({
      where,
      select: {
        id: true,
        valor_emprestado: true,
        valor_principal_base: true,
        valor_parcela: true,
        numero_parcelas: true,
        status: true,
        cliente: { select: { nome: true } }
      }
    }),
    prisma.emprestimo.count({ where })
  ]);

  const ids = emprestimos.map((e) => e.id);

  if (ids.length === 0) {
    return {
      rows: [] as EmprestimoListRow[],
      total,
      page,
      pageSize: EMPRESTIMOS_PAGE_SIZE,
      totalPages: Math.max(1, Math.ceil(total / EMPRESTIMOS_PAGE_SIZE))
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

  const statsPorEmprestimo = new Map<string, { pagas: number; emAberto: number }>();

  for (const row of parcelaStats) {
    const current = statsPorEmprestimo.get(row.emprestimo_id) ?? { pagas: 0, emAberto: 0 };
    if (row.status === "paga") {
      current.pagas += row._count.id;
    } else {
      current.emAberto +=
        toNumber(row._sum.valor_atualizado) || toNumber(row._sum.valor_original);
    }
    statsPorEmprestimo.set(row.emprestimo_id, current);
  }

  const allRows: EmprestimoListRow[] = emprestimos.map((e) => {
    const stats = statsPorEmprestimo.get(e.id) ?? { pagas: 0, emAberto: 0 };
    return {
      id: e.id,
      valorEmprestado: toNumber(e.valor_emprestado),
      valorPrincipalBase: toNumber(e.valor_principal_base) || toNumber(e.valor_emprestado),
      valorParcela: toNumber(e.valor_parcela),
      numeroParcelas: e.numero_parcelas,
      status: e.status,
      clienteNome: e.cliente.nome,
      emAberto: stats.emAberto,
      parcelasPagas: stats.pagas,
      proximoVencimento: proximoPorEmprestimo.get(e.id) ?? null
    };
  });

  const rows = sortByProximoVencimento(allRows).slice(skip, skip + EMPRESTIMOS_PAGE_SIZE);

  return {
    rows,
    total,
    page,
    pageSize: EMPRESTIMOS_PAGE_SIZE,
    totalPages: Math.max(1, Math.ceil(total / EMPRESTIMOS_PAGE_SIZE))
  };
}

export async function getClientesParaEmprestimo() {
  return prisma.cliente.findMany({
    select: { id: true, nome: true, cpf: true },
    orderBy: { nome: "asc" }
  });
}
