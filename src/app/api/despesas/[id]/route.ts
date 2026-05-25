import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  try {
    const existing = await prisma.despesa.findUnique({ where: { id: params.id }, select: { id: true } });
    if (!existing) {
      return NextResponse.json({ error: "Despesa não encontrada." }, { status: 404 });
    }

    await prisma.despesa.delete({ where: { id: params.id } });
    revalidatePath("/despesas");
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[DELETE /api/despesas/[id]]", error);
    return NextResponse.json({ error: "Não foi possível excluir a despesa." }, { status: 500 });
  }
}
