import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { buildDespesaVencimentos, splitValorEmParcelas } from "@/lib/despesa-schedule";
import { extractCalendarDayKey } from "@/lib/finance";
import { getDespesasList } from "@/lib/queries/despesas-list";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const page = Number(searchParams.get("page") ?? "1") || 1;
  const data = await getDespesasList(page);
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const descricao = String(body.descricao ?? "").trim();
    const valorTotal = Number(body.valorTotal ?? body.valor ?? 0);
    const parcelado = Boolean(body.parcelado);
    const numeroParcelas = parcelado ? Math.max(1, Number(body.numeroParcelas ?? 1)) : 1;
    const primeiroVencimentoRaw = String(body.primeiroVencimento ?? body.vencimento ?? "").trim();
    const primeiroDayKey = extractCalendarDayKey(primeiroVencimentoRaw);

    if (!descricao) {
      return NextResponse.json({ error: "Informe a descrição da despesa." }, { status: 400 });
    }
    if (!Number.isFinite(valorTotal) || valorTotal <= 0) {
      return NextResponse.json({ error: "Informe um valor válido." }, { status: 400 });
    }
    if (!primeiroDayKey) {
      return NextResponse.json({ error: "Informe a data de vencimento (dd/mm/aaaa)." }, { status: 400 });
    }
    if (parcelado && numeroParcelas < 2) {
      return NextResponse.json({ error: "Despesa parcelada precisa de pelo menos 2 parcelas." }, { status: 400 });
    }

    const vencimentos = buildDespesaVencimentos(primeiroDayKey, numeroParcelas);
    const valores = splitValorEmParcelas(valorTotal, numeroParcelas);

    const despesa = await prisma.despesa.create({
      data: {
        descricao,
        valor_total: valorTotal,
        parcelado,
        numero_parcelas: numeroParcelas,
        parcelas: {
          create: vencimentos.map((vencimento, index) => ({
            numero_parcela: index + 1,
            valor: valores[index],
            vencimento
          }))
        }
      },
      include: { parcelas: { orderBy: { numero_parcela: "asc" } } }
    });

    revalidatePath("/despesas");
    return NextResponse.json(despesa, { status: 201 });
  } catch (error) {
    console.error("[POST /api/despesas]", error);
    return NextResponse.json({ error: "Não foi possível salvar a despesa." }, { status: 500 });
  }
}
