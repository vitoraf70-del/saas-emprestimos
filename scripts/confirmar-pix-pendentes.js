/* eslint-disable no-console */
const { PrismaClient } = require("@prisma/client");

async function main() {
  const prisma = new PrismaClient();
  const base = "http://localhost:3000";
  const pendentes = await prisma.pagamento.findMany({
    where: { status: "pendente" },
    orderBy: { data_pagamento: "desc" },
    take: 10
  });

  console.log("Verificando", pendentes.length, "pagamento(s) pendente(s)...");

  for (const p of pendentes) {
    try {
      const res = await fetch(`${base.replace(/\/$/, "")}/api/pix/verificar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactionId: p.transaction_id })
      });
      const data = await res.json();
      console.log(p.transaction_id, data);
    } catch (e) {
      console.error(p.transaction_id, e.message);
    }
  }

  const pagos = await prisma.parcela.count({ where: { status: "paga" } });
  const abertas = await prisma.parcela.count({ where: { status: { in: ["pendente", "vencida"] } } });
  console.log({ parcelasPagas: pagos, parcelasAbertas: abertas });

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
