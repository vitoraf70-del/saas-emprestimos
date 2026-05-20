import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { deleteEmprestimo } from "@/actions/emprestimos";

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const exists = await prisma.emprestimo.findUnique({ where: { id: params.id }, select: { id: true } });
  if (!exists) {
    return NextResponse.json({ error: "Empréstimo não encontrado." }, { status: 404 });
  }

  try {
    await deleteEmprestimo(params.id);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível excluir o empréstimo.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
