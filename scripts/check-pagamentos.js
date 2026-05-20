/* eslint-disable no-console */
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const pagamentos = await prisma.pagamento.findMany({
    orderBy: { data_pagamento: "desc" },
    take: 8,
    include: { parcela: { include: { emprestimo: { include: { cliente: true } } } } }
  });

  const parcelasAbertas = await prisma.parcela.count({
    where: { status: { in: ["pendente", "vencida"] } }
  });
  const parcelasPagas = await prisma.parcela.count({ where: { status: "paga" } });

  console.log(
    JSON.stringify(
      {
        parcelasAbertas,
        parcelasPagas,
        ultimosPagamentos: pagamentos.map((x) => ({
          status: x.status,
          valor: String(x.valor_pago),
          txid: x.transaction_id,
          cliente: x.parcela.emprestimo.cliente.nome,
          parcela: x.numero_parcela,
          parcelaStatus: x.parcela.status,
          data: x.data_pagamento
        }))
      },
      null,
      2
    )
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
