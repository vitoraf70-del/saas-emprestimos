// Expira a cortesia: reativa multa/juros das parcelas com vencimento entre
// 30/06 e 02/07/2026 que continuarem SEM PAGAR após o prazo de tolerância
// (fim de 04/07). Rode a partir de 05/07/2026. Quem já pagou fica de fora.
//
// Uso: npx tsx scripts/reativar-encargos-grace.ts
//   (para testar antes da data, use FORCE=1)
import { PrismaClient } from "@prisma/client";
import { calendarDayKeyBR, calcularParcelaComIsencao, diasAtraso } from "../src/lib/finance";
import { syncEmprestimoStatus } from "../src/lib/emprestimo-status";

const prisma = new PrismaClient();

const APLICAR_A_PARTIR_DE = "2026-07-05";

async function main() {
  const hojeKey = calendarDayKeyBR(new Date());
  if (hojeKey < APLICAR_A_PARTIR_DE && process.env.FORCE !== "1") {
    console.log(
      `Ainda no prazo de tolerância (hoje ${hojeKey}). Rode a partir de ${APLICAR_A_PARTIR_DE} ou use FORCE=1.`
    );
    return;
  }

  const start = new Date("2026-06-30T00:00:00-04:00");
  const end = new Date("2026-07-03T00:00:00-04:00"); // exclusivo (até 02/07)

  const parcelas = await prisma.parcela.findMany({
    where: {
      vencimento: { gte: start, lt: end },
      encargos_isentos: true,
      status: { in: ["pendente", "vencida"] }
    },
    select: {
      id: true,
      numero_parcela: true,
      valor_original: true,
      vencimento: true,
      emprestimo_id: true,
      emprestimo: {
        select: { frequencia_parcela: true, cliente: { select: { nome: true } } }
      }
    },
    orderBy: { vencimento: "asc" }
  });

  console.log(`Hoje: ${hojeKey}`);
  console.log(`Parcelas ainda sem pagar (30/06-02/07) para voltar a cobrar: ${parcelas.length}\n`);

  const emprestimos = new Set<string>();

  for (const p of parcelas) {
    const dias = diasAtraso(p.vencimento);
    const calc = calcularParcelaComIsencao(
      Number(p.valor_original),
      dias,
      p.emprestimo.frequencia_parcela,
      false,
      false
    );

    await prisma.parcela.update({
      where: { id: p.id },
      data: {
        encargos_isentos: false,
        juros_isentos: false,
        dias_atraso: calc.diasAtraso,
        multa_valor: calc.multaValor,
        juros_valor: calc.jurosValor,
        valor_atualizado: calc.valorAtualizado,
        status: calc.diasAtraso > 0 ? "vencida" : "pendente"
      }
    });

    emprestimos.add(p.emprestimo_id);
    console.log(
      `${p.emprestimo.cliente.nome} | parcela ${p.numero_parcela} | venc ${calendarDayKeyBR(
        p.vencimento
      )} | ${dias}d atraso | multa R$ ${calc.multaValor.toFixed(2)} + juros R$ ${calc.jurosValor.toFixed(
        2
      )} = R$ ${calc.valorAtualizado.toFixed(2)}`
    );
  }

  for (const id of emprestimos) await syncEmprestimoStatus(id);

  console.log("\n=== Resumo ===");
  console.log({ reativadas: parcelas.length, emprestimosResincronizados: emprestimos.size });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => process.exit(0));
