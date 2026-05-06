import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const payload = await request.json();
  const transactionId = String(payload?.data?.id ?? payload?.payment?.id ?? "");
  if (!transactionId) return NextResponse.json({ ok: true });

  const pagamento = await prisma.pagamento.findUnique({ where: { transaction_id: transactionId } });
  if (!pagamento) return NextResponse.json({ ok: true });

  await prisma.pagamento.update({
    where: { id: pagamento.id },
    data: { status: "confirmado", data_pagamento: new Date() }
  });

  await prisma.parcela.update({
    where: { id: pagamento.parcela_id },
    data: { status: "paga", data_pagamento: new Date() }
  });

  return NextResponse.json({ ok: true });
}
