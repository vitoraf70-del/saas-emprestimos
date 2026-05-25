import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const body = await request.json();
    const status = body.status === "paga" ? "paga" : body.status === "pendente" ? "pendente" : null;

    if (!status) {
      return NextResponse.json({ error: "Status inválido." }, { status: 400 });
    }

    const parcela = await prisma.despesaParcela.findUnique({
      where: { id: params.id },
      select: { id: true }
    });
    if (!parcela) {
      return NextResponse.json({ error: "Parcela não encontrada." }, { status: 404 });
    }

    const updated = await prisma.despesaParcela.update({
      where: { id: params.id },
      data: {
        status,
        data_pagamento: status === "paga" ? new Date() : null
      }
    });

    revalidatePath("/despesas");
    return NextResponse.json(updated);
  } catch (error) {
    console.error("[PATCH /api/despesas/parcelas/[id]]", error);
    return NextResponse.json({ error: "Não foi possível atualizar a parcela." }, { status: 500 });
  }
}
