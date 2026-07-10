import { NextResponse } from "next/server";
import { recalculateOpenParcelas } from "@/actions/parcelas";
import {
  canScheduleContinuation,
  parseContinuationDepth,
  scheduleCronContinuation
} from "@/lib/cron-continuation";
import { reconciliarPagamentosPendentes } from "@/lib/services/pix-baixa";
import {
  type CobrancaAutomaticaResult,
  contarCobrancasPendentes,
  processarCobrancaAutomatica
} from "@/lib/services/cobranca-automatica";
import { expirarCortesiaEncargos } from "@/lib/services/cortesia-encargos";
import { notificarCobrador } from "@/lib/services/notificar-cobrador";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const CRON_RUN_BUDGET_MS = 58000;

function authorizeCron(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  const url = new URL(request.url);
  const fromQuery = url.searchParams.get("secret");
  const fromHeader = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  return fromQuery === secret || fromHeader === secret;
}

function mergeCobranca(
  total: CobrancaAutomaticaResult,
  partial: CobrancaAutomaticaResult
): CobrancaAutomaticaResult {
  return {
    processadas: total.processadas + partial.processadas,
    enviadas: total.enviadas + partial.enviadas,
    ignoradas: total.ignoradas + partial.ignoradas,
    erros: total.erros + partial.erros,
    pendentes: partial.pendentes,
    detalhes: total.detalhes.concat(partial.detalhes)
  };
}

async function processarCobrancaCompletandoFila() {
  const runStart = Date.now();
  let cobranca: CobrancaAutomaticaResult = {
    processadas: 0,
    enviadas: 0,
    ignoradas: 0,
    erros: 0,
    pendentes: 0,
    detalhes: []
  };
  let loops = 0;

  while (Date.now() - runStart < CRON_RUN_BUDGET_MS) {
    loops++;
    const remaining = CRON_RUN_BUDGET_MS - (Date.now() - runStart);
    const partial = await processarCobrancaAutomatica({
      deadlineMs: Math.max(8000, remaining - 1000)
    });
    cobranca = mergeCobranca(cobranca, partial);
    if (partial.pendentes === 0) break;
  }

  return { cobranca, loops };
}

export async function GET(request: Request) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const continuationDepth = parseContinuationDepth(request);
  const isContinuation = continuationDepth > 0;

  let cortesia: Awaited<ReturnType<typeof expirarCortesiaEncargos>> | null = null;
  let cobrador: Awaited<ReturnType<typeof notificarCobrador>> | null = null;
  if (!isContinuation) {
    cortesia = await expirarCortesiaEncargos();
    cobrador = await notificarCobrador();
  }

  const cobrancaRun = await processarCobrancaCompletandoFila();
  const cobranca = cobrancaRun.cobranca;
  let pixBaixa: Awaited<ReturnType<typeof reconciliarPagamentosPendentes>> | null = null;
  let parcelas: { atualizadas: boolean } | null = null;

  if (!isContinuation) {
    [pixBaixa, parcelas] = await Promise.all([
      reconciliarPagamentosPendentes(),
      recalculateOpenParcelas().then(() => ({ atualizadas: true as const }))
    ]);
  }

  const aindaPendentes = await contarCobrancasPendentes();
  const deveContinuar =
    aindaPendentes > 0 && canScheduleContinuation(continuationDepth);

  if (deveContinuar) {
    await scheduleCronContinuation(request, continuationDepth);
  }

  return NextResponse.json({
    ok: true,
    continuation: isContinuation,
    continuationDepth,
    continuacaoAgendada: deveContinuar,
    cobrancaLoops: cobrancaRun.loops,
    cortesia: cortesia ?? { ignorado: "continuação" },
    cobrador: cobrador ?? { ignorado: "continuação" },
    cobranca: { ...cobranca, filaRestante: aindaPendentes },
    pixBaixa: pixBaixa ?? { ignorado: "continuação — só cobrança WhatsApp" },
    parcelas: parcelas ?? { atualizadas: false, ignorado: "continuação" }
  });
}
