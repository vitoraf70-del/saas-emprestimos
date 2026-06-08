import { Prisma, StatusParcela } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const PARCELAS_PAGE_SIZE = 50;

export type ParcelasListFilters = {
  nome?: string;
  cpf?: string;
  status?: StatusParcela;
  page?: number;
};

function buildWhere(filters: ParcelasListFilters): Prisma.ParcelaWhereInput {
  const nome = filters.nome?.trim();
  const cpf = filters.cpf?.trim();

  return {
    status: filters.status || undefined,
    emprestimo: {
      cliente: {
        nome: nome ? { contains: nome, mode: "insensitive" } : undefined,
        cpf: cpf ? { contains: cpf } : undefined
      }
    }
  };
}

export async function getParcelasList(filters: ParcelasListFilters) {
  const page = Math.max(1, filters.page ?? 1);
  const where = buildWhere(filters);
  const skip = (page - 1) * PARCELAS_PAGE_SIZE;

  const [parcelas, total] = await Promise.all([
    prisma.parcela.findMany({
      where,
      select: {
        id: true,
        numero_parcela: true,
        vencimento: true,
        valor_atualizado: true,
        valor_original: true,
        multa_valor: true,
        juros_valor: true,
        encargos_isentos: true,
        status: true,
        emprestimo: {
          select: {
            cliente_id: true,
            cliente: { select: { nome: true } }
          }
        }
      },
      orderBy: { vencimento: "asc" },
      take: PARCELAS_PAGE_SIZE,
      skip
    }),
    prisma.parcela.count({ where })
  ]);

  return {
    parcelas,
    total,
    page,
    pageSize: PARCELAS_PAGE_SIZE,
    totalPages: Math.max(1, Math.ceil(total / PARCELAS_PAGE_SIZE))
  };
}
