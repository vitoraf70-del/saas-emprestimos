import { NextResponse } from "next/server";
import { verificarEBaixarPagamento } from "@/lib/services/pix-baixa";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const transactionId = String(body.transactionId ?? "").trim();
    if (!transactionId) {
      return NextResponse.json({ error: "transactionId obrigatório." }, { status: 400 });
    }

    const result = await verificarEBaixarPagamento(transactionId);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao verificar pagamento.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
