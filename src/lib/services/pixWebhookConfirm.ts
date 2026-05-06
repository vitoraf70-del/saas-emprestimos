import { prisma } from "@/lib/prisma";
import { calcularParcelaAtualizada, diasAtraso } from "@/lib/finance";

export function parseParcelaIdsFromSolicitacao(s: string) {
  const multi = s.match(/pids:([\w,]+)/);
  if (multi?.[1]) {
    return multi[1]
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);
  }
  const one = s.match(/pid:([\w-]+)/);
  return one?.[1] ? [one[1].trim()] : [];
}

function amountClose(a: number, b: number, tol = 0.02) {
  return Math.abs(a - b) <= tol;
}

export async function confirmPagamentoByTxid(
  txid: string,
  getSolicitacaoPagador: (id: string) => Promise<string>
) {
  const pagamento = await prisma.pagamento.findUnique({
    where: { transaction_id: txid }
  });
  if (!pagamento || pagamento.status === "confirmado") return false;

  let solicitacao = "";
  try {
    solicitacao = await getSolicitacaoPagador(txid);
  } catch {
    solicitacao = "";
  }

  const parcelaIds = parseParcelaIdsFromSolicitacao(solicitacao);
  const targetIds = parcelaIds.length > 0 ? parcelaIds : [pagamento.parcela_id];

  const parcelas = await prisma.parcela.findMany({
    where: { id: { in: targetIds } }
  });
  if (parcelas.length === 0) return false;

  let sum = 0;
  for (const p of parcelas) {
    const atraso = diasAtraso(p.vencimento);
    const calc = calcularParcelaAtualizada(Number(p.valor_original), atraso);
    sum += calc.valorAtualizado;
  }

  const valorPagamento = Number(pagamento.valor_pago);
  if (!amountClose(sum, valorPagamento)) {
    return false;
  }

  await prisma.$transaction(async (tx) => {
    await tx.pagamento.update({
      where: { id: pagamento.id },
      data: {
        status: "confirmado",
        data_pagamento: new Date()
      }
    });

    for (const p of parcelas) {
      await tx.parcela.update({
        where: { id: p.id },
        data: {
          status: "paga",
          data_pagamento: new Date()
        }
      });
    }
  });

  return true;
}
