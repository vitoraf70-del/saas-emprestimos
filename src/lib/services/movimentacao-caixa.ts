import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type Db = Prisma.TransactionClient | typeof prisma;

export async function getTotalRecebidoConfirmado() {
  const agg = await prisma.pagamento.aggregate({
    where: { status: "confirmado" },
    _sum: { valor_pago: true }
  });
  return toNumber(agg._sum.valor_pago);
}

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

export async function getGestaoCaixaData() {
  const [config, liberadoNovosAgg, liberadoRenovacoesAgg, recebidoAgg] = await Promise.all([
    prisma.configCaixa.findUnique({ where: { id: "default" } }),
    prisma.$queryRaw<{ total: Prisma.Decimal | null }[]>`
      SELECT SUM(COALESCE(valor_principal_base, valor_emprestado)) AS total
      FROM "Emprestimo"
    `,
    prisma.movimentacaoCaixa.aggregate({
      where: { tipo: "renovacao" },
      _sum: { valor: true }
    }),
    prisma.pagamento.aggregate({
      where: { status: "confirmado" },
      _sum: { valor_pago: true }
    })
  ]);

  const saldoInicial = toNumber(config?.saldo_inicial);
  const liberadoNovos = toNumber(liberadoNovosAgg[0]?.total);
  const liberadoRenovacoes = toNumber(liberadoRenovacoesAgg._sum.valor);
  const recebido = toNumber(recebidoAgg._sum.valor_pago);
  const saldoAtual = saldoInicial + recebido - liberadoNovos - liberadoRenovacoes;

  return {
    saldoInicial,
    liberadoNovos,
    liberadoRenovacoes,
    recebido,
    saldoAtual
  };
}
