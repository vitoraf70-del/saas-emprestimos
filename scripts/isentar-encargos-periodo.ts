// Retira multa e juros (isenta encargos) das parcelas com vencimento entre
// 30/06/2026 e 03/07/2026 — período em que a cobrança automática ficou fora do ar.
// Replica a ação "isentar_encargos" do app: zera multa/juros, marca os flags
// de isenção (persistem no recálculo) e volta o valor ao original.
import { PrismaClient } from "@prisma/client";
import { calendarDayKeyBR } from "../src/lib/finance";
import { syncEmprestimoStatus } from "../src/lib/emprestimo-status";

const prisma = new PrismaClient();

const INICIO = "2026-06-30";
const FIM = "2026-07-03"; // inclusive

async function main() {
  const start = new Date(`${INICIO}T00:00:00-04:00`);
  const end = new Date("2026-07-04T00:00:00-04:00"); // exclusivo (captura até 03/07)

  const parcelas = await prisma.parcela.findMany({
    where: {
      vencimento: { gte: start, lt: end },
      status: { in: ["pendente", "vencida"] }
    },
    select: {
      id: true,
      numero_parcela: true,
      valor_original: true,
      multa_valor: true,
      juros_valor: true,
      valor_atualizado: true,
      vencimento: true,
      encargos_isentos: true,
      emprestimo_id: true,
      emprestimo: { select: { cliente: { select: { nome: true } } } }
    },
    orderBy: { vencimento: "asc" }
  });

  console.log(`Período: ${INICIO} a ${FIM}`);
  console.log(`Parcelas encontradas: ${parcelas.length}\n`);

  const emprestimosAfetados = new Set<string>();
  let isentadas = 0;
  let jaIsentas = 0;

  for (const p of parcelas) {
    const multa = Number(p.multa_valor);
    const juros = Number(p.juros_valor);
    const original = Number(p.valor_original);

    if (p.encargos_isentos) {
      jaIsentas++;
      continue;
    }

    await prisma.parcela.update({
      where: { id: p.id },
      data: {
        encargos_isentos: true,
        juros_isentos: true,
        multa_valor: 0,
        juros_valor: 0,
        valor_atualizado: original
      }
    });

    emprestimosAfetados.add(p.emprestimo_id);
    isentadas++;

    console.log(
      `${p.emprestimo.cliente.nome} | parcela ${p.numero_parcela} | venc ${calendarDayKeyBR(
        p.vencimento
      )} | removido: multa R$ ${multa.toFixed(2)} + juros R$ ${juros.toFixed(
        2
      )} | valor ${Number(p.valor_atualizado).toFixed(2)} -> ${original.toFixed(2)}`
    );
  }

  for (const empId of emprestimosAfetados) {
    await syncEmprestimoStatus(empId);
  }

  console.log("\n=== Resumo ===");
  console.log({
    isentadas,
    jaIsentas,
    emprestimosResincronizados: emprestimosAfetados.size
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => process.exit(0));
