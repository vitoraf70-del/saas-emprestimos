import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { deleteEmprestimo, updateEmprestimo, type UpdateEmprestimoParcelaInput } from "@/actions/emprestimos";

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const exists = await prisma.emprestimo.findUnique({ where: { id: params.id }, select: { id: true } });
  if (!exists) {
    return NextResponse.json({ error: "Empréstimo não encontrado." }, { status: 404 });
  }

  try {
    const body = await request.json();
    const valorEmprestado =
      body.valorEmprestado != null ? Number(body.valorEmprestado) : undefined;
    const valorParcela = body.valorParcela != null ? Number(body.valorParcela) : undefined;

    const parcelas: UpdateEmprestimoParcelaInput[] | undefined = Array.isArray(body.parcelas)
      ? body.parcelas.map((item: Record<string, unknown>) => ({
          id: String(item.id ?? ""),
          valorOriginal: Number(item.valorOriginal),
          vencimento: String(item.vencimento ?? "")
        }))
      : undefined;

    if (parcelas?.some((p) => !p.id)) {
      return NextResponse.json({ error: "Parcela inválida no payload." }, { status: 400 });
    }

    await updateEmprestimo(params.id, { valorEmprestado, valorParcela, parcelas });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível atualizar o empréstimo.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  revalidatePath("/");
  revalidatePath("/emprestimos");
  revalidatePath("/parcelas");

  return NextResponse.json({ ok: true });
}

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
