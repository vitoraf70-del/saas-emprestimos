import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // 1) Parcela paga sem nenhum pagamento confirmado
  const pagaSemConfirmado = await prisma.parcela.findMany({
    where: {
      status: "paga",
      NOT: { pagamentos: { some: { status: "confirmado" } } }
    },
    include: { emprestimo: { include: { cliente: { select: { nome: true } } } } },
    take: 20
  });

  // 2) Pagamento confirmado mas parcela NÃO paga (o bug original)
  const confirmadoParcelaAberta = await prisma.pagamento.findMany({
    where: {
      status: "confirmado",
      parcela: { status: { in: ["pendente", "vencida"] } }
    },
    include: {
      parcela: { include: { emprestimo: { include: { cliente: { select: { nome: true } } } } } }
    }
  });

  // 3) Parcela com data_pagamento mas status aberto
  const dataPagamentoStatusAberto = await prisma.parcela.findMany({
    where: {
      status: { in: ["pendente", "vencida"] },
      data_pagamento: { not: null }
    },
    include: { emprestimo: { include: { cliente: { select: { nome: true } } } } }
  });

  // 4) Pagamentos pendentes em parcelas já pagas (PIX gerado mas parcela baixada manual/outro txid)
  const pendenteEmParcelaPaga = await prisma.pagamento.findMany({
    where: {
      status: "pendente",
      parcela: { status: "paga" }
    },
    include: {
      parcela: { include: { emprestimo: { include: { cliente: { select: { nome: true } } } } } }
    },
    orderBy: { data_pagamento: "desc" },
    take: 30
  });

  console.log("=== AUDITORIA DE INCONSISTÊNCIAS ===\n");

  console.log(`[BUG RACE] Pagamento confirmado + parcela aberta: ${confirmadoParcelaAberta.length}`);
  for (const pg of confirmadoParcelaAberta) {
    console.log(
      `  ${pg.parcela.emprestimo.cliente.nome} P${pg.parcela.numero_parcela} (${pg.parcela.status}) R$${pg.valor_pago}`
    );
  }

  console.log(`\n[BUG RACE] data_pagamento preenchida + status aberto: ${dataPagamentoStatusAberto.length}`);
  for (const p of dataPagamentoStatusAberto) {
    console.log(`  ${p.emprestimo.cliente.nome} P${p.numero_parcela} (${p.status}) R$${p.valor_atualizado}`);
  }

  console.log(`\n[OUTRO] Parcela paga sem pagamento confirmado: ${pagaSemConfirmado.length}`);
  for (const p of pagaSemConfirmado.slice(0, 10)) {
    console.log(`  ${p.emprestimo.cliente.nome} P${p.numero_parcela} (baixa manual provável)`);
  }
  if (pagaSemConfirmado.length > 10) console.log(`  ... e mais ${pagaSemConfirmado.length - 10}`);

  console.log(`\n[ATENÇÃO] PIX pendente em parcela já paga: ${pendenteEmParcelaPaga.length}`);
  const porCliente = new Map<string, number>();
  for (const pg of pendenteEmParcelaPaga) {
    const nome = pg.parcela.emprestimo.cliente.nome;
    porCliente.set(nome, (porCliente.get(nome) ?? 0) + 1);
  }
  for (const [nome, qtd] of [...porCliente.entries()].slice(0, 15)) {
    console.log(`  ${nome}: ${qtd} PIX pendente(s) em parcela já paga`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
