import { NextResponse } from "next/server";
import { verificarSaudeWhatsApp } from "@/lib/services/whatsapp-health";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

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

  const result = await verificarSaudeWhatsApp();
  return NextResponse.json(result);
}
