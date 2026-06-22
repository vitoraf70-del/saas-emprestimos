import { Prisma, StatusParcela } from "@prisma/client";
import { calendarDayKeyBR, calendarDayRangeCampoGrande, calcularParcelaComIsencao, diasAtraso } from "@/lib/finance";
import { prisma } from "@/lib/prisma";

export const PARCELAS_RESUMO_PAGE_SIZE = 25;

const toNumber = (value: Prisma.Decimal | number | null | undefined) =>
  Number(value ?? 0);

export type ParcelaAbertaRow = {
  id: string;
  numeroParcela: number;
  vencimento: Date;
  valorOriginal: number;
  valorAtualizado: number;
  multa: number;
  juros: number;
  encargosIsentos: boolean;
  jurosIsentos: boolean;
  status: StatusParcela;
};

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
  parcelasAbertas: ParcelaAbertaRow[];
};

export type ParcelasResumoStatusFilter =
  | StatusParcela
  | "aberto"
  | "quitado"
  | "todos";

export type ParcelasResumoFilters = {
  page?: number;
  nome?: string;
  cpf?: string;
  status?: ParcelasResumoStatusFilter;
};

function parcelasWhereFromStatus(
  status: ParcelasResumoStatusFilter | undefined
): Prisma.ParcelaListRelationFilter | undefined {
  const effective = status ?? "aberto";

  if (effective === "todos") return undefined;
  if (effective === "aberto") {
    return { some: { status: { in: ["pendente", "vencida"] } } };
  }
  if (effective === "quitado") {
    return { every: { status: "paga" } };
  }
  return { some: { status: effective } };
}

function buildWhere(filters: ParcelasResumoFilters): Prisma.EmprestimoWhereInput {
  const nome = filters.nome?.trim();
  const cpf = filters.cpf?.trim();
  const parcelas = parcelasWhereFromStatus(filters.status);

  return {
    cliente: {
      nome: nome ? { contains: nome, mode: "insensitive" } : undefined,
      cpf: cpf ? { contains: cpf } : undefined
    },
    parcelas
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

export async function getReceberHojeResumo() {
  const hojeKey = calendarDayKeyBR(new Date());
  const { start, end } = calendarDayRangeCampoGrande(hojeKey);

  const [agg, quantidade] = await Promise.all([
    prisma.parcela.aggregate({
      where: {
        status: { in: ["pendente", "vencida"] },
        vencimento: { gte: start, lt: end }
      },
      _sum: { valor_atualizado: true, valor_original: true }
    }),
    prisma.parcela.count({
      where: {
        status: { in: ["pendente", "vencida"] },
        vencimento: { gte: start, lt: end }
      }
    })
  ]);

  return {
    data: hojeKey,
    total: toNumber(agg._sum.valor_atualizado) || toNumber(agg._sum.valor_original),
    quantidade
  };
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

  type ResumoRowBase = Omit<ParcelasResumoRow, "parcelasAbertas">;

  const allRows: ResumoRowBase[] = emprestimos.map((e) => {
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
  const pageEmprestimoIds = rows.map((row) => row.emprestimoId);

  const parcelasAbertasPorEmprestimo = new Map<string, ParcelaAbertaRow[]>();

  if (pageEmprestimoIds.length > 0) {
    const parcelasAbertas = await prisma.parcela.findMany({
      where: {
        emprestimo_id: { in: pageEmprestimoIds },
        status: { in: ["pendente", "vencida"] }
      },
      select: {
        id: true,
        emprestimo_id: true,
        numero_parcela: true,
        vencimento: true,
        valor_original: true,
        valor_atualizado: true,
        multa_valor: true,
        juros_valor: true,
        encargos_isentos: true,
        juros_isentos: true,
        status: true,
        emprestimo: { select: { frequencia_parcela: true } }
      },
      orderBy: { vencimento: "asc" }
    });

    for (const parcela of parcelasAbertas) {
      const dias = diasAtraso(parcela.vencimento);
      const calc = calcularParcelaComIsencao(
        toNumber(parcela.valor_original),
        dias,
        parcela.emprestimo.frequencia_parcela,
        parcela.encargos_isentos,
        parcela.juros_isentos
      );
      const current = parcelasAbertasPorEmprestimo.get(parcela.emprestimo_id) ?? [];
      current.push({
        id: parcela.id,
        numeroParcela: parcela.numero_parcela,
        vencimento: parcela.vencimento,
        valorOriginal: toNumber(parcela.valor_original),
        valorAtualizado: calc.valorAtualizado,
        multa: calc.multaValor,
        juros: calc.jurosValor,
        encargosIsentos: parcela.encargos_isentos,
        jurosIsentos: parcela.juros_isentos,
        status: parcela.status
      });
      parcelasAbertasPorEmprestimo.set(parcela.emprestimo_id, current);
    }
  }

  const rowsWithParcelas = rows.map((row) => ({
    ...row,
    parcelasAbertas: parcelasAbertasPorEmprestimo.get(row.emprestimoId) ?? []
  }));

  return {
    rows: rowsWithParcelas,
    total,
    page,
    pageSize: PARCELAS_RESUMO_PAGE_SIZE,
    totalPages: Math.max(1, Math.ceil(total / PARCELAS_RESUMO_PAGE_SIZE))
  };
}
