import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { renovarEmprestimo } from "@/actions/emprestimos";
import { prisma } from "@/lib/prisma";
import type { FrequenciaParcela } from "@/lib/parcel-schedule";

function isFrequencia(value: string): value is FrequenciaParcela {
  return value === "diario" || value === "semanal";
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const emprestimoBase = await prisma.emprestimo.findUnique({
      where: { id: params.id },
      select: { id: true, cliente_id: true }
    });

    if (!emprestimoBase) {
      return NextResponse.json({ error: "Empréstimo não encontrado para renovação." }, { status: 404 });
    }

    const body = await request.json();
    const frequencia = String(body.frequencia ?? "semanal");
    if (!isFrequencia(frequencia)) {
      return NextResponse.json({ error: "Frequência inválida. Use diario ou semanal." }, { status: 400 });
    }

    const valorLiberadoCaixa = Number(body.valorLiberadoCaixa ?? 0);
    const numeroParcelas = Number(body.numeroParcelas);
    const valorParcela = Number(body.valorParcela);
    const primeiroVencimento = String(body.primeiroVencimento ?? "");

    if (!primeiroVencimento) {
      return NextResponse.json({ error: "Informe o primeiro vencimento." }, { status: 400 });
    }

    const emprestimoRenovado = await renovarEmprestimo(params.id, {
      clienteId: emprestimoBase.cliente_id,
      valorLiberadoCaixa,
      numeroParcelas,
      valorParcela,
      frequencia,
      primeiroVencimento
    });

    revalidatePath("/");
    revalidatePath("/emprestimos");
    revalidatePath("/parcelas");

    return NextResponse.json(emprestimoRenovado, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao renovar empréstimo.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
