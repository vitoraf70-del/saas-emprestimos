import type { Prisma, StatusEmprestimo } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type Db = Prisma.TransactionClient | typeof prisma;

export async function syncEmprestimoStatus(emprestimoId: string, db: Db = prisma) {
  const parcelas = await db.parcela.findMany({
    where: { emprestimo_id: emprestimoId },
    select: { status: true }
  });
  if (parcelas.length === 0) return;

  let status: StatusEmprestimo = "ativo";
  if (parcelas.every((p) => p.status === "paga")) {
    status = "quitado";
  } else if (parcelas.some((p) => p.status === "vencida")) {
    status = "inadimplente";
  }

  await db.emprestimo.update({
    where: { id: emprestimoId },
    data: { status }
  });
}
