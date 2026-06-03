import { Prisma } from "@prisma/client";
import { calendarDayRangeCampoGrande, extractCalendarDayKey } from "@/lib/finance";
import { prisma } from "@/lib/prisma";

const toNumber = (value: Prisma.Decimal | number | null | undefined) =>
  Number(value ?? 0);

export type EmprestimoPorDataRow = {
  id: string;
  clienteId: string;
  clienteNome: string;
  clienteCpf: string;
  valorEmprestado: number;
  valorParcela: number;
  numeroParcelas: number;
  status: string;
  createdAt: string;
};

export type ClientePorDataRow = {
  id: string;
  nome: string;
  cpf: string;
  whatsapp: string;
  createdAt: string;
};

export type ConsultaPorDataResult = {
  data: string;
  emprestimos: EmprestimoPorDataRow[];
  clientes: ClientePorDataRow[];
};

export function resolveConsultaPorDataDayKey(value: string | null | undefined) {
  if (!value) return null;
  return extractCalendarDayKey(value);
}

export async function getConsultaPorData(dayKey: string): Promise<ConsultaPorDataResult> {
  const { start, end } = calendarDayRangeCampoGrande(dayKey);

  const [emprestimos, clientes] = await Promise.all([
    prisma.emprestimo.findMany({
      where: { created_at: { gte: start, lt: end } },
      select: {
        id: true,
        valor_emprestado: true,
        valor_parcela: true,
        numero_parcelas: true,
        status: true,
        created_at: true,
        cliente: { select: { id: true, nome: true, cpf: true } }
      },
      orderBy: { created_at: "asc" }
    }),
    prisma.cliente.findMany({
      where: { created_at: { gte: start, lt: end } },
      select: {
        id: true,
        nome: true,
        cpf: true,
        whatsapp: true,
        created_at: true
      },
      orderBy: { created_at: "asc" }
    })
  ]);

  return {
    data: dayKey,
    emprestimos: emprestimos.map((e) => ({
      id: e.id,
      clienteId: e.cliente.id,
      clienteNome: e.cliente.nome,
      clienteCpf: e.cliente.cpf,
      valorEmprestado: toNumber(e.valor_emprestado),
      valorParcela: toNumber(e.valor_parcela),
      numeroParcelas: e.numero_parcelas,
      status: e.status,
      createdAt: e.created_at.toISOString()
    })),
    clientes: clientes.map((c) => ({
      id: c.id,
      nome: c.nome,
      cpf: c.cpf,
      whatsapp: c.whatsapp,
      createdAt: c.created_at.toISOString()
    }))
  };
}
