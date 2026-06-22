import { prisma } from "@/lib/prisma";
import { syncEmprestimoStatus } from "@/lib/emprestimo-status";
import { revalidateAppAfterPayment } from "@/lib/revalidate-app";
import { sendWhatsAppMessage } from "@/lib/services/whatsapp";
import { toCurrency } from "@/lib/utils";

export type CobrancaPixLookup = {
  solicitacaoPagador: string;
  status?: string;
  valorOriginal?: number;
};

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

async function notificarClientePagamento(parcelaIds: string[], valorPago: number) {
  const parcela = await prisma.parcela.findFirst({
    where: { id: { in: parcelaIds } },
    include: { emprestimo: { include: { cliente: true } } }
  });
  if (!parcela?.emprestimo.cliente.whatsapp) return;

  const qtd = parcelaIds.length;
  const textoParcelas = qtd > 1 ? `${qtd} parcelas` : `parcela ${parcela.numero_parcela}`;

  try {
    await sendWhatsAppMessage({
      phone: parcela.emprestimo.cliente.whatsapp,
      message: `Pagamento confirmado! Recebemos ${toCurrency(valorPago)} referente à ${textoParcelas}. Obrigado, ${parcela.emprestimo.cliente.nome}!`
    });
  } catch {
    // Baixa já foi feita; falha no WhatsApp não reverte o pagamento.
  }
}

export async function confirmPagamentoByTxid(
  txid: string,
  getCobranca: (id: string) => Promise<CobrancaPixLookup | string>
) {
  const pagamento = await prisma.pagamento.findUnique({
    where: { transaction_id: txid }
  });
  if (!pagamento || pagamento.status === "confirmado") return false;

  let cob: CobrancaPixLookup;
  try {
    const raw = await getCobranca(txid);
    cob = typeof raw === "string" ? { solicitacaoPagador: raw } : raw;
  } catch {
    cob = { solicitacaoPagador: "" };
  }

  const pagoNoBanco = cob.status === "CONCLUIDA";
  const parcelaIds = parseParcelaIdsFromSolicitacao(cob.solicitacaoPagador);
  const targetIds = parcelaIds.length > 0 ? parcelaIds : [pagamento.parcela_id];

  const parcelas = await prisma.parcela.findMany({
    where: { id: { in: targetIds } },
    include: { emprestimo: { select: { frequencia_parcela: true } } }
  });
  if (parcelas.length === 0) return false;

  const valorPagamento = Number(pagamento.valor_pago);

  if (!pagoNoBanco) {
    const { calcularParcelaComIsencao, diasAtraso } = await import("@/lib/finance");
    let sum = 0;
    for (const p of parcelas) {
      const atraso = diasAtraso(p.vencimento);
      const calc = calcularParcelaComIsencao(
        Number(p.valor_original),
        atraso,
        p.emprestimo.frequencia_parcela,
        p.encargos_isentos,
        p.juros_isentos
      );
      sum += calc.valorAtualizado;
    }
    const valorCob = cob.valorOriginal ?? sum;
    if (!amountClose(sum, valorPagamento) && !amountClose(valorCob, valorPagamento)) {
      return false;
    }
  } else if (cob.valorOriginal && !amountClose(cob.valorOriginal, valorPagamento)) {
    return false;
  }

  // Só uma requisição concurrente (webhook + poll + cron) pode confirmar e notificar.
  const claimed = await prisma.pagamento.updateMany({
    where: { id: pagamento.id, status: "pendente" },
    data: {
      status: "confirmado",
      data_pagamento: new Date()
    }
  });
  if (claimed.count === 0) return false;

  try {
    await prisma.$transaction(async (tx) => {
      for (const p of parcelas) {
        await tx.parcela.update({
          where: { id: p.id },
          data: {
            status: "paga",
            data_pagamento: new Date(),
            dias_atraso: 0,
            multa_valor: 0,
            juros_valor: 0,
            valor_atualizado: p.valor_original
          }
        });
      }

      const emprestimoIds = [...new Set(parcelas.map((p) => p.emprestimo_id))];
      for (const emprestimoId of emprestimoIds) {
        await syncEmprestimoStatus(emprestimoId, tx);
      }
    });
  } catch (error) {
    await prisma.pagamento.updateMany({
      where: { id: pagamento.id, status: "confirmado" },
      data: { status: "pendente", data_pagamento: pagamento.data_pagamento }
    });
    throw error;
  }

  await notificarClientePagamento(targetIds, valorPagamento);
  revalidateAppAfterPayment();
  return true;
}
