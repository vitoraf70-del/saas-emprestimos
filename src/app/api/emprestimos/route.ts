import { NextResponse } from "next/server";
import { createEmprestimoSimples } from "@/actions/emprestimos";
import { isValidInstallments, isValidLoanAmount } from "@/lib/loan-plans";

export async function POST(request: Request) {
  const body = await request.json();

  if (!body.clienteId || !body.valor || !body.numeroParcelas || !body.primeiroVencimento) {
    return NextResponse.json(
      { error: "Dados obrigatórios: cliente, valor, parcelas e primeiro vencimento." },
      { status: 400 }
    );
  }

  const valor = Number(body.valor);
  const numeroParcelas = Number(body.numeroParcelas);
  const parcelasVencimentos = Array.isArray(body.parcelasVencimentos)
    ? body.parcelasVencimentos.map((item: unknown) => String(item))
    : [];
  if (!isValidLoanAmount(valor)) {
    return NextResponse.json({ error: "Valor inválido. Use 500, 700 ou 1000." }, { status: 400 });
  }
  if (!isValidInstallments(numeroParcelas)) {
    return NextResponse.json({ error: "Parcelamento inválido. Use 4, 6 ou 8." }, { status: 400 });
  }
  if (parcelasVencimentos.length > 0 && parcelasVencimentos.length !== numeroParcelas) {
    return NextResponse.json({ error: "Quantidade de vencimentos incompatível com o número de parcelas." }, { status: 400 });
  }

  const emprestimo = await createEmprestimoSimples({
    clienteId: String(body.clienteId),
    valor,
    numeroParcelas,
    primeiroVencimento: String(body.primeiroVencimento),
    parcelasVencimentos
  });

  return NextResponse.json(emprestimo, { status: 201 });
}
