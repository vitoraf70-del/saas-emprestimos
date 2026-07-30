import { NextResponse } from "next/server";
import { processarMensagemWhatsApp } from "@/lib/services/whatsapp-atendimento";
import { parseInboundWhatsApp } from "@/lib/services/whatsapp-inbound";
import {
  parseEvolutionConnectionEvent,
  verificarSaudeWhatsApp
} from "@/lib/services/whatsapp-health";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorizeWebhook(request: Request) {
  const secret = process.env.WHATSAPP_WEBHOOK_SECRET?.trim();
  if (!secret) return true;
  const url = new URL(request.url);
  const fromQuery = url.searchParams.get("secret");
  const fromHeader = request.headers.get("x-webhook-secret");
  return fromQuery === secret || fromHeader === secret;
}

export async function POST(request: Request) {
  if (!authorizeWebhook(request)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const connectionState = parseEvolutionConnectionEvent(body);
  if (connectionState) {
    const health = await verificarSaudeWhatsApp({
      forceAlert: connectionState === "close",
      stateOverride: connectionState
    });
    return NextResponse.json({ ok: true, connection: health });
  }

  const provider = process.env.WHATSAPP_PROVIDER ?? "evolution";
  const inbound = parseInboundWhatsApp(body, provider);
  if (!inbound) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  try {
    await processarMensagemWhatsApp(inbound);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[webhook whatsapp]", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    provider: process.env.WHATSAPP_PROVIDER ?? "evolution",
    hint: "POST: messages.upsert + connection.update (Evolution)."
  });
}
