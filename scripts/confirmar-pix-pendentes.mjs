import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const { verificarEBaixarPagamento, reconciliarPagamentosPendentes } = await import(
    "../src/lib/services/pix-baixa.ts"
  );

  const pendentes = await prisma.pagamento.findMany({
    where: { status: "pendente" },
    orderBy: { data_pagamento: "desc" },
    take: 10,
    include: { parcela: { include: { emprestimo: { include: { cliente: true } } } } }
  });

  console.log(`Pendentes: ${pendentes.length}`);

  for (const p of pendentes) {
    const r = await verificarEBaixarPagamento(p.transaction_id);
    console.log({
      txid: p.transaction_id,
      cliente: p.parcela.emprestimo.cliente.nome,
      ...r
    });
  }

  const recon = await reconciliarPagamentosPendentes();
  console.log("Reconciliação:", recon);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
