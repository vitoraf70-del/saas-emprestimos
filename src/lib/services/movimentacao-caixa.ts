import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type Db = Prisma.TransactionClient | typeof prisma;

const toNumber = (value: Prisma.Decimal | number | null | undefined) => Number(value ?? 0);

export async function registrarSaidaNovoEmprestimo(
  emprestimoId: string,
  valor: number,
  db: Db = prisma,
  descricao = "Novo empréstimo"
) {
  if (valor <= 0) return;

  await db.movimentacaoCaixa.create({
    data: {
      tipo: "novo_emprestimo",
      valor,
      emprestimo_id: emprestimoId,
      descricao
    }
  });
}

export async function registrarSaidaRenovacao(
  emprestimoId: string,
  valor: number,
  db: Db = prisma,
  descricao = "Renovação de empréstimo"
) {
  if (valor <= 0) return;

  await db.movimentacaoCaixa.create({
    data: {
      tipo: "renovacao",
      valor,
      emprestimo_id: emprestimoId,
      descricao
    }
  });
}

export async function registrarEntradaRecebimento(
  input: {
    pagamentoId: string;
    parcelaId: string;
    emprestimoId: string;
    valor: number;
    descricao?: string;
  },
  db: Db = prisma
) {
  if (input.valor <= 0) return;

  const exists = await db.movimentacaoCaixa.findUnique({
    where: { pagamento_id: input.pagamentoId },
    select: { id: true }
  });
  if (exists) return;

  await db.movimentacaoCaixa.create({
    data: {
      tipo: "recebimento",
      valor: input.valor,
      pagamento_id: input.pagamentoId,
      parcela_id: input.parcelaId,
      emprestimo_id: input.emprestimoId,
      descricao: input.descricao ?? "Recebimento de cliente"
    }
  });
}

export async function getGestaoCaixaData(dayKey?: string) {
  const { calendarDayRangeCampoGrande, calendarDayKeyBR } = await import("@/lib/finance");
  const hojeKey = dayKey ?? calendarDayKeyBR(new Date());
  const { start, end } = calendarDayRangeCampoGrande(hojeKey);

  const [config, liberadoNovosAgg, liberadoRenovacoesAgg, recebidoAgg, liberadoHojeAgg] =
    await Promise.all([
      prisma.configCaixa.findUnique({ where: { id: "default" } }),
      prisma.movimentacaoCaixa.aggregate({
        where: { tipo: "novo_emprestimo" },
        _sum: { valor: true }
      }),
      prisma.movimentacaoCaixa.aggregate({
        where: { tipo: "renovacao" },
        _sum: { valor: true }
      }),
      prisma.pagamento.aggregate({
        where: { status: "confirmado" },
        _sum: { valor_pago: true }
      }),
      prisma.movimentacaoCaixa.aggregate({
        where: {
          created_at: { gte: start, lt: end },
          tipo: { in: ["novo_emprestimo", "renovacao"] }
        },
        _sum: { valor: true }
      })
    ]);

  const saldoInicial = toNumber(config?.saldo_inicial);
  const liberadoNovos = toNumber(liberadoNovosAgg._sum.valor);
  const liberadoRenovacoes = toNumber(liberadoRenovacoesAgg._sum.valor);
  const recebido = toNumber(recebidoAgg._sum.valor_pago);
  const liberadoHoje = toNumber(liberadoHojeAgg._sum.valor);
  const saldoAtual = saldoInicial + recebido - liberadoNovos - liberadoRenovacoes;

  return {
    saldoInicial,
    liberadoNovos,
    liberadoRenovacoes,
    liberadoHoje,
    recebido,
    saldoAtual
  };
}
