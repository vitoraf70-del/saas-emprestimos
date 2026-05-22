import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { formatDateBR } from "@/lib/date";
import { deleteEmprestimo, updateEmprestimo, type UpdateEmprestimoParcelaInput } from "@/actions/emprestimos";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const emprestimo = await prisma.emprestimo.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      valor_emprestado: true,
      valor_parcela: true,
      cliente: { select: { nome: true } },
      parcelas: {
        select: {
          id: true,
          numero_parcela: true,
          status: true,
          valor_original: true,
          vencimento: true
        },
        orderBy: { numero_parcela: "asc" }
      }
    }
  });

  if (!emprestimo) {
    return NextResponse.json({ error: "Empréstimo não encontrado." }, { status: 404 });
  }

  return NextResponse.json({
    id: emprestimo.id,
    clienteNome: emprestimo.cliente.nome,
    valorEmprestado: Number(emprestimo.valor_emprestado),
    valorParcela: Number(emprestimo.valor_parcela),
    parcelas: emprestimo.parcelas.map((p) => ({
      id: p.id,
      numero_parcela: p.numero_parcela,
      status: p.status,
      valor_original: Number(p.valor_original),
      vencimento: formatDateBR(p.vencimento)
    }))
  });
}

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
