import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncEmprestimoStatus } from "@/lib/emprestimo-status";
import { revalidateAppAfterPayment } from "@/lib/revalidate-app";
import { revalidatePath } from "next/cache";

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const body = await request.json();

    if (body.action === "isentar_encargos") {
      const parcela = await prisma.parcela.findUnique({
        where: { id: params.id },
        select: {
          id: true,
          status: true,
          valor_original: true,
          multa_valor: true,
          juros_valor: true,
          encargos_isentos: true,
          emprestimo_id: true
        }
      });

      if (!parcela) {
        return NextResponse.json({ error: "Parcela não encontrada." }, { status: 404 });
      }

      if (parcela.status === "paga") {
        return NextResponse.json({ error: "Parcela já está paga." }, { status: 400 });
      }

      if (parcela.encargos_isentos) {
        return NextResponse.json({ error: "Multa e juros já foram retirados desta parcela." }, { status: 400 });
      }

      const temEncargos = Number(parcela.multa_valor) > 0 || Number(parcela.juros_valor) > 0;
      if (!temEncargos) {
        return NextResponse.json({ error: "Esta parcela não possui multa ou juros." }, { status: 400 });
      }

      const updated = await prisma.parcela.update({
        where: { id: parcela.id },
        data: {
          encargos_isentos: true,
          multa_valor: 0,
          juros_valor: 0,
          valor_atualizado: parcela.valor_original
        }
      });

      await syncEmprestimoStatus(parcela.emprestimo_id);
      revalidatePath("/parcelas");
      revalidateAppAfterPayment();
      return NextResponse.json(updated);
    }

    if (body.status !== "paga") {
      return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
    }

    const parcela = await prisma.parcela.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        status: true,
        valor_atualizado: true,
        valor_original: true,
        emprestimo_id: true
      }
    });

    if (!parcela) {
      return NextResponse.json({ error: "Parcela não encontrada." }, { status: 404 });
    }

    if (parcela.status === "paga") {
      return NextResponse.json({ error: "Parcela já está paga." }, { status: 400 });
    }

    const valorPago = Number(parcela.valor_atualizado) || Number(parcela.valor_original);
    const agora = new Date();

    const updated = await prisma.$transaction(async (tx) => {
      await tx.pagamento.create({
        data: {
          parcela_id: parcela.id,
          valor_pago: valorPago,
          metodo: "pix",
          transaction_id: `manual-${parcela.id}`,
          data_pagamento: agora,
          status: "confirmado"
        }
      });

      const parcelaAtualizada = await tx.parcela.update({
        where: { id: parcela.id },
        data: {
          status: "paga",
          data_pagamento: agora,
          valor_atualizado: valorPago
        }
      });

      await syncEmprestimoStatus(parcela.emprestimo_id, tx);
      return parcelaAtualizada;
    });

    revalidateAppAfterPayment();
    return NextResponse.json(updated);
  } catch (error) {
    console.error("[PATCH /api/parcelas/[id]]", error);
    return NextResponse.json({ error: "Não foi possível atualizar a parcela." }, { status: 500 });
  }
}
