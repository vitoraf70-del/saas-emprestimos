/**
 * Corrige parcelas salvas 1 dia antes do vencimento escolhido (bug de UTC meia-noite).
 * Uso: npx tsx scripts/shift-vencimentos-plus-one-day.ts [--apply] [--cliente "nome"]
 *
 * Sem --apply, apenas lista o que seria alterado.
 */
import { PrismaClient } from "@prisma/client";
import { addDays } from "date-fns";
import { calendarDayKeyBR, dateFromCalendarDayKey, normalizeVencimento } from "../src/lib/finance";

const prisma = new PrismaClient();
const apply = process.argv.includes("--apply");
const clienteArg = process.argv.find((a) => a.startsWith("--cliente="));
const clienteFiltro = clienteArg?.split("=")[1]?.toLowerCase().trim();

async function main() {
  if (!clienteFiltro) {
    console.error('Informe o cliente: --cliente="vitor hugo"');
    process.exit(1);
  }
  const parcelas = await prisma.parcela.findMany({
    where: { status: { in: ["pendente", "vencida"] } },
    include: { emprestimo: { include: { cliente: true } } },
    orderBy: { vencimento: "asc" }
  });

  const candidatas = parcelas.filter((p) => {
    if (clienteFiltro && !p.emprestimo.cliente.nome.toLowerCase().includes(clienteFiltro)) {
      return false;
    }
    return true;
  });

  if (candidatas.length === 0) {
    console.log("Nenhuma parcela em aberto encontrada.");
    return;
  }

  console.log(apply ? "Aplicando correção (+1 dia no calendário BR)..." : "Dry-run (use --apply para gravar):");
  for (const p of candidatas) {
    const antes = calendarDayKeyBR(p.vencimento);
    const shifted = normalizeVencimento(addDays(p.vencimento, 1));
    const depois = calendarDayKeyBR(shifted);
    console.log(
      `- ${p.emprestimo.cliente.nome} parcela ${p.numero_parcela}: ${antes} → ${depois}${apply ? " [ok]" : ""}`
    );
    if (apply) {
      await prisma.parcela.update({
        where: { id: p.id },
        data: {
          vencimento: shifted,
          dias_atraso: 0,
          multa_valor: 0,
          juros_valor: 0,
          valor_atualizado: p.valor_original,
          status: "pendente"
        }
      });
    }
  }

  if (apply) {
    const emprestimoIds = [...new Set(candidatas.map((p) => p.emprestimo_id))];
    for (const id of emprestimoIds) {
      const { syncEmprestimoStatus } = await import("../src/lib/emprestimo-status");
      const { recalculateParcela } = await import("../src/actions/parcelas");
      await syncEmprestimoStatus(id);
      const abertas = await prisma.parcela.findMany({
        where: { emprestimo_id: id, status: { in: ["pendente", "vencida"] } },
        select: { id: true }
      });
      for (const { id: parcelaId } of abertas) {
        await recalculateParcela(parcelaId);
      }
    }
    console.log("Concluído. Rode o cron ou recalculate se precisar atualizar valores.");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
