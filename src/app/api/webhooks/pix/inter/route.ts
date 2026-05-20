import { NextResponse } from "next/server";
import { getCobrancaPixInfo } from "@/lib/services/pix-baixa";
import { confirmPagamentoByTxid } from "@/lib/services/pixWebhookConfirm";

type PixItem = {
  txid?: string;
};

function extractPixItems(payload: unknown): PixItem[] {
  if (!payload || typeof payload !== "object") return [];
  const body = payload as Record<string, unknown>;

  if (Array.isArray(body.pix)) return body.pix as PixItem[];
  if (Array.isArray(body?.data) && body.data.length > 0) return body.data as PixItem[];
  if (body.txid) return [body as PixItem];

  return [];
}

export async function POST(request: Request) {
  const secret = process.env.PIX_INTER_WEBHOOK_SECRET?.trim();
  const headerSecret = request.headers.get("x-webhook-secret")?.trim();
  if (secret && headerSecret !== secret) {
    return NextResponse.json({ error: "Webhook não autorizado." }, { status: 401 });
  }

  const payload = await request.json();
  const pixItems = extractPixItems(payload);
  if (pixItems.length === 0) {
    return NextResponse.json({ ok: true, processed: 0 });
  }

  let processed = 0;
  for (const pix of pixItems) {
    const txid = String(pix.txid ?? "").trim();
    if (!txid) continue;

    const ok = await confirmPagamentoByTxid(txid, async (id) => {
      const info = await getCobrancaPixInfo(id);
      return info ?? { solicitacaoPagador: "" };
    });
    if (ok) processed += 1;
  }

  return NextResponse.json({ ok: true, processed });
}
