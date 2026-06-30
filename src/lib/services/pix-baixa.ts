import { prisma } from "@/lib/prisma";
import {
  confirmPagamentoByTxid,
  parseParcelaIdsFromSolicitacao,
  type CobrancaPixLookup
} from "@/lib/services/pixWebhookConfirm";

export async function getCobrancaPixInfo(txid: string): Promise<CobrancaPixLookup | null> {
  const provider = (process.env.PIX_PROVIDER ?? "mercado_pago").toLowerCase();

  try {
    if (provider === "inter") {
      const { interGetCobrancaImediata } = await import("@/lib/services/interPix");
      const cob = await interGetCobrancaImediata(txid);
      return {
        solicitacaoPagador: String(cob.solicitacaoPagador ?? ""),
        status: String((cob as { status?: string }).status ?? ""),
        valorOriginal: Number((cob as { valor?: { original?: string } }).valor?.original ?? 0) || undefined
      };
    }

    if (provider === "c6") {
      const { c6GetCobrancaImediata } = await import("@/lib/services/c6Pix");
      const cob = await c6GetCobrancaImediata(txid);
      return {
        solicitacaoPagador: String(cob.solicitacaoPagador ?? ""),
        status: String((cob as { status?: string }).status ?? ""),
        valorOriginal: Number((cob as { valor?: { original?: string } }).valor?.original ?? 0) || undefined
      };
    }
  } catch {
    return null;
  }

  return null;
}

export type VerificarBaixaResult = {
  ok: boolean;
  baixado: boolean;
  motivo: string;
  statusBanco?: string;
};

/**
 * Recupera pagamentos pagos no banco mas sem registro local (ex.: falha ao salvar Pagamento).
 * Usa o pid/pids em solicitacaoPagador da cobrança CONCLUIDA no Inter/C6.
 */
export async function garantirPagamentoPorTxid(txid: string): Promise<boolean> {
  const existente = await prisma.pagamento.findUnique({ where: { transaction_id: txid } });
  if (existente) return true;

  const info = await getCobrancaPixInfo(txid);
  if (!info || info.status !== "CONCLUIDA") return false;

  const parcelaIds = parseParcelaIdsFromSolicitacao(info.solicitacaoPagador);
  if (parcelaIds.length === 0) return false;

  const parcelas = await prisma.parcela.findMany({
    where: { id: { in: parcelaIds }, status: { in: ["pendente", "vencida"] } }
  });
  if (parcelas.length === 0) return false;

  const valorPago =
    info.valorOriginal ??
    parcelas.reduce((sum, p) => sum + Number(p.valor_atualizado || p.valor_original), 0);

  await prisma.pagamento.create({
    data: {
      parcela_id: parcelaIds[0]!,
      valor_pago: valorPago,
      metodo: "pix",
      transaction_id: txid,
      status: "pendente"
    }
  });

  return true;
}

export async function verificarEBaixarPagamento(txid: string): Promise<VerificarBaixaResult> {
  let pagamento = await prisma.pagamento.findUnique({
    where: { transaction_id: txid },
    select: { status: true }
  });

  if (!pagamento) {
    const recuperado = await garantirPagamentoPorTxid(txid);
    if (!recuperado) {
      return { ok: false, baixado: false, motivo: "pagamento_nao_encontrado" };
    }
    pagamento = await prisma.pagamento.findUnique({
      where: { transaction_id: txid },
      select: { status: true }
    });
    if (!pagamento) {
      return { ok: false, baixado: false, motivo: "pagamento_nao_encontrado" };
    }
  }

  if (pagamento.status === "confirmado") {
    return { ok: true, baixado: true, motivo: "ja_confirmado" };
  }

  const info = await getCobrancaPixInfo(txid);
  if (!info) {
    return { ok: false, baixado: false, motivo: "consulta_banco_indisponivel" };
  }

  if (info.status && info.status !== "CONCLUIDA") {
    return {
      ok: true,
      baixado: false,
      motivo: "aguardando_pagamento",
      statusBanco: info.status
    };
  }

  const baixado = await confirmPagamentoByTxid(txid, async () => info);
  return {
    ok: baixado,
    baixado,
    motivo: baixado ? "baixa_realizada" : "falha_validacao",
    statusBanco: info.status
  };
}

/** Reconcilia pagamentos PIX pendentes consultando o banco (backup do webhook). */
export async function reconciliarPagamentosPendentes(limit = 200) {
  const { repararParcelasComPagamentoConfirmado } = await import("@/lib/services/parcelas-reparo");
  const reparo = await repararParcelasComPagamentoConfirmado();

  const pendentes = await prisma.pagamento.findMany({
    where: { status: "pendente" },
    orderBy: { data_pagamento: "desc" },
    take: limit,
    select: { transaction_id: true }
  });

  let baixados = 0;
  for (const item of pendentes) {
    const result = await verificarEBaixarPagamento(item.transaction_id);
    if (result.baixado && result.motivo === "baixa_realizada") {
      baixados += 1;
    }
  }

  return { verificados: pendentes.length, baixados, reparadas: reparo.reparadas };
}
