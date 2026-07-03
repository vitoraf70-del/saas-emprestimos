// Reverte a isenção de encargos SÓ das parcelas com vencimento em 03/07/2026.
// Elas venciam hoje e não deviam ficar isentas pra sempre — voltam a cobrar
// multa/juros normalmente caso atrasem.
import { PrismaClient } from "@prisma/client";
import { calendarDayKeyBR, calcularParcelaComIsencao, diasAtraso } from "../src/lib/finance";
import { syncEmprestimoStatus } from "../src/lib/emprestimo-status";

const prisma = new PrismaClient();

async function main() {
  const start = new Date("2026-07-03T00:00:00-04:00");
  const end = new Date("2026-07-04T00:00:00-04:00");

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

  console.log(`Parcelas de 03/07 para reverter: ${parcelas.length}\n`);

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
      )} | isenção removida (encargos voltam a correr normal)`
    );
  }

  for (const id of emprestimos) await syncEmprestimoStatus(id);

  console.log("\n=== Resumo ===");
  console.log({ revertidas: parcelas.length, emprestimosResincronizados: emprestimos.size });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => process.exit(0));
