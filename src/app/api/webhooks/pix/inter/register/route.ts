import { NextResponse } from "next/server";
import {
  getInterWebhookCallbackUrl,
  interDeletePixWebhook,
  interGetPixWebhook,
  interPutPixWebhook
} from "@/lib/services/interPix";

export const dynamic = "force-dynamic";

function authorizeCron(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return true;

  const url = new URL(request.url);
  const fromQuery = url.searchParams.get("secret");
  const fromHeader = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  return fromQuery === secret || fromHeader === secret;
}

/** Cadastra ou consulta o webhook PIX no Banco Inter (requer CRON_SECRET se definido). */
export async function GET(request: Request) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  try {
    const cadastrado = await interGetPixWebhook();
    return NextResponse.json({
      ok: true,
      callbackUrlEsperada: getInterWebhookCallbackUrl(),
      cadastrado
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao consultar webhook.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const url = new URL(request.url);
  const action = url.searchParams.get("action");

  try {
    if (action === "delete") {
      const result = await interDeletePixWebhook();
      return NextResponse.json({ ok: true, ...result });
    }

    let webhookUrl: string | undefined;
    try {
      const body = (await request.json()) as { webhookUrl?: string };
      webhookUrl = body.webhookUrl?.trim();
    } catch {
      webhookUrl = undefined;
    }

    const result = await interPutPixWebhook(webhookUrl);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao registrar webhook.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
