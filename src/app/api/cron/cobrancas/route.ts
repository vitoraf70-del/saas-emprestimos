import { NextResponse } from "next/server";
import { recalculateOpenParcelas } from "@/actions/parcelas";
import {
  canScheduleContinuation,
  parseContinuationDepth,
  scheduleCronContinuation
} from "@/lib/cron-continuation";
import { reconciliarPagamentosPendentes } from "@/lib/services/pix-baixa";
import {
  contarCobrancasPendentes,
  processarCobrancaAutomatica
} from "@/lib/services/cobranca-automatica";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorizeCron(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  const url = new URL(request.url);
  const fromQuery = url.searchParams.get("secret");
  const fromHeader = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  return fromQuery === secret || fromHeader === secret;
}

export async function GET(request: Request) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const continuationDepth = parseContinuationDepth(request);
  const isContinuation = continuationDepth > 0;

  const cobranca = await processarCobrancaAutomatica();
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
    scheduleCronContinuation(request, continuationDepth);
  }

  return NextResponse.json({
    ok: true,
    continuation: isContinuation,
    continuationDepth,
    continuacaoAgendada: deveContinuar,
    cobranca: { ...cobranca, filaRestante: aindaPendentes },
    pixBaixa: pixBaixa ?? { ignorado: "continuação — só cobrança WhatsApp" },
    parcelas: parcelas ?? { atualizadas: false, ignorado: "continuação" }
  });
}
