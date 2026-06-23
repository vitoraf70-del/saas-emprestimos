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

export type RenovacaoPorDataRow = {
  id: string;
  emprestimoId: string;
  clienteId: string;
  clienteNome: string;
  valorCarteira: number;
  valorCaixa: number;
  valorParcela: number;
  numeroParcelas: number;
  status: string;
  createdAt: string;
};

export type ConsultaPorDataResult = {
  data: string;
  emprestimos: EmprestimoPorDataRow[];
  renovacoes: RenovacaoPorDataRow[];
  clientes: ClientePorDataRow[];
};

type RenovacaoMeta = {
  valorCarteira?: number;
  numeroParcelas?: number;
  valorParcela?: number;
};

function parseRenovacaoMeta(descricao: string | null): RenovacaoMeta | null {
  if (!descricao) return null;
  try {
    const parsed = JSON.parse(descricao) as RenovacaoMeta;
    if (typeof parsed.valorCarteira === "number") return parsed;
  } catch {
    return null;
  }
  return null;
}

export function resolveConsultaPorDataDayKey(value: string | null | undefined) {
  if (!value) return null;
  return extractCalendarDayKey(value);
}

export async function getConsultaPorData(dayKey: string): Promise<ConsultaPorDataResult> {
  const { start, end } = calendarDayRangeCampoGrande(dayKey);

  const [emprestimos, renovacoes, clientes] = await Promise.all([
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
    prisma.movimentacaoCaixa.findMany({
      where: {
        tipo: "renovacao",
        created_at: { gte: start, lt: end }
      },
      select: {
        id: true,
        valor: true,
        descricao: true,
        created_at: true,
        emprestimo: {
          select: {
            id: true,
            status: true,
            valor_parcela: true,
            numero_parcelas: true,
            cliente: { select: { id: true, nome: true } }
          }
        }
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
    renovacoes: renovacoes
      .filter((r) => r.emprestimo)
      .map((r) => {
        const meta = parseRenovacaoMeta(r.descricao);
        const emprestimo = r.emprestimo!;

        return {
          id: r.id,
          emprestimoId: emprestimo.id,
          clienteId: emprestimo.cliente.id,
          clienteNome: emprestimo.cliente.nome,
          valorCarteira: meta?.valorCarteira ?? toNumber(r.valor),
          valorCaixa: toNumber(r.valor),
          valorParcela: meta?.valorParcela ?? toNumber(emprestimo.valor_parcela),
          numeroParcelas: meta?.numeroParcelas ?? emprestimo.numero_parcelas,
          status: emprestimo.status,
          createdAt: r.created_at.toISOString()
        };
      }),
    clientes: clientes.map((c) => ({
      id: c.id,
      nome: c.nome,
      cpf: c.cpf,
      whatsapp: c.whatsapp,
      createdAt: c.created_at.toISOString()
    }))
  };
}
