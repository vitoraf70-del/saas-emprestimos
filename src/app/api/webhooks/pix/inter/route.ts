import { NextResponse } from "next/server";
import { processInterPixWebhookPayload } from "@/lib/services/interWebhook";

/**
 * GET — validação de URL ao cadastrar webhook no Inter (e health check).
 * POST — notificação PIX (corpo padrão Bacen: { "pix": [ { "txid": "..." } ] }).
 *
 * O Inter não envia x-webhook-secret; a baixa só ocorre se o txid existir no sistema
 * e a cobrança estiver CONCLUIDA no Inter (consulta via API).
 */
export async function GET() {
  return NextResponse.json({ ok: true, service: "inter-pix-webhook" });
}

export async function POST(request: Request) {
  const secret = process.env.PIX_INTER_WEBHOOK_SECRET?.trim();
  const headerSecret = request.headers.get("x-webhook-secret")?.trim();
  if (secret && headerSecret && headerSecret !== secret) {
    return NextResponse.json({ error: "Webhook não autorizado." }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const { processed, results } = await processInterPixWebhookPayload(payload);
  return NextResponse.json({ ok: true, processed, results });
}
