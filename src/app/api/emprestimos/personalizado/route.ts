import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createEmprestimoPersonalizado } from "@/actions/emprestimos";
import type { FrequenciaParcela } from "@/lib/parcel-schedule";

function isFrequencia(value: string): value is FrequenciaParcela {
  return value === "diario" || value === "semanal";
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (
      !body.clienteId ||
      !body.valorEmprestado ||
      !body.numeroParcelas ||
      !body.valorParcela ||
      !body.primeiroVencimento ||
      !body.frequencia
    ) {
      return NextResponse.json(
        { error: "Preencha cliente, valor emprestado, parcelas, valor da parcela, frequência e primeiro vencimento." },
        { status: 400 }
      );
    }

    const frequencia = String(body.frequencia);
    if (!isFrequencia(frequencia)) {
      return NextResponse.json({ error: "Frequência inválida. Use diario ou semanal." }, { status: 400 });
    }

    const valorEmprestado = Number(body.valorEmprestado);
    const numeroParcelas = Number(body.numeroParcelas);
    const valorParcela = Number(body.valorParcela);
    const parcelasVencimentos = Array.isArray(body.parcelasVencimentos)
      ? body.parcelasVencimentos.map((item: unknown) => String(item))
      : [];

    if (parcelasVencimentos.length > 0 && parcelasVencimentos.length !== numeroParcelas) {
      return NextResponse.json(
        { error: "Quantidade de vencimentos incompatível com o número de parcelas." },
        { status: 400 }
      );
    }

    const emprestimo = await createEmprestimoPersonalizado({
      clienteId: String(body.clienteId),
      valorEmprestado,
      numeroParcelas,
      valorParcela,
      frequencia,
      primeiroVencimento: String(body.primeiroVencimento),
      parcelasVencimentos
    });

    revalidatePath("/");
    revalidatePath("/emprestimos");
    revalidatePath("/parcelas");

    return NextResponse.json(emprestimo, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao criar empréstimo personalizado.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
