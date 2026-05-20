import { NextResponse } from "next/server";
import { reconciliarPagamentosPendentes } from "@/lib/services/pix-baixa";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const url = new URL(request.url);
    const fromQuery = url.searchParams.get("secret");
    const fromHeader = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (fromQuery !== secret && fromHeader !== secret) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }
  }

  const resultado = await reconciliarPagamentosPendentes();
  return NextResponse.json({ ok: true, ...resultado });
}
