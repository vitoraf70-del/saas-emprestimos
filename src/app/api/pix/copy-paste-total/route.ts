import { NextResponse } from "next/server";
import { gerarPixComRegistro } from "@/lib/services/pix-gerar";
import { prisma } from "@/lib/prisma";
import { calcularParcelaComIsencao, diasAtraso } from "@/lib/finance";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parcelaIds = Array.isArray(body.parcelaIds) ? body.parcelaIds.map((id: unknown) => String(id)) : [];
    if (parcelaIds.length === 0) {
      return NextResponse.json({ error: "Selecione ao menos uma parcela." }, { status: 400 });
    }

    const parcelas = await prisma.parcela.findMany({
      where: {
        id: { in: parcelaIds },
        status: { in: ["pendente", "vencida"] }
      },
      include: { emprestimo: { include: { cliente: true } } },
      orderBy: { vencimento: "asc" }
    });

    if (parcelas.length === 0) {
      return NextResponse.json({ error: "Nenhuma parcela pendente encontrada." }, { status: 404 });
    }

    const clienteId = parcelas[0].emprestimo.cliente.id;
    const parcelasMesmoCliente = parcelas.every((parcela) => parcela.emprestimo.cliente.id === clienteId);
    if (!parcelasMesmoCliente) {
      return NextResponse.json({ error: "As parcelas devem pertencer ao mesmo cliente." }, { status: 400 });
    }

    const atualizadas = await prisma.$transaction(
      parcelas.map((parcela) => {
        const atraso = diasAtraso(parcela.vencimento);
        const calc = calcularParcelaComIsencao(
          Number(parcela.valor_original),
          atraso,
          parcela.emprestimo.frequencia_parcela,
          parcela.encargos_isentos,
          parcela.juros_isentos
        );
        return prisma.parcela.update({
          where: { id: parcela.id },
          data: {
            dias_atraso: calc.diasAtraso,
            multa_valor: calc.multaValor,
            juros_valor: calc.jurosValor,
            valor_atualizado: calc.valorAtualizado,
            status: calc.diasAtraso > 0 ? "vencida" : "pendente"
          }
        });
      })
    );

    const valorTotal = atualizadas.reduce((acc, parcela) => acc + Number(parcela.valor_atualizado), 0);
    const cliente = parcelas[0].emprestimo.cliente;
    const parcelaIdsJoin = atualizadas.map((p) => p.id).join(",");
    const solicitacaoPagador = `Quitacao ${atualizadas.length} parcelas`;
    const descricaoBase = `${solicitacaoPagador} | pids:${parcelaIdsJoin}`;
    const description = descricaoBase.slice(0, 140);
    const pix = await gerarPixComRegistro({
      seed: `public-quitacao-${cliente.id}-${Date.now()}`,
      parcelaId: atualizadas[0]!.id,
      amount: Number(valorTotal.toFixed(2)),
      description,
      payerName: cliente.nome,
      payerCpf: cliente.cpf.replace(/\D/g, "")
    });

    return NextResponse.json({
      copyPasteCode: pix.copyPasteCode,
      transactionId: pix.transactionId,
      valorTotal,
      quantidadeParcelas: atualizadas.length
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao gerar PIX da quitação.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
