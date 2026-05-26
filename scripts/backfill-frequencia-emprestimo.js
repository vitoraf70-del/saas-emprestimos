/* eslint-disable no-console */
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

function calendarDayKeyBR(date) {
  return date.toLocaleDateString("en-CA", { timeZone: "America/Campo_Grande" });
}

function diasEntre(a, b) {
  const [y1, m1, d1] = calendarDayKeyBR(a).split("-").map(Number);
  const [y2, m2, d2] = calendarDayKeyBR(b).split("-").map(Number);
  const from = Date.UTC(y2, m2 - 1, d2);
  const to = Date.UTC(y1, m1 - 1, d1);
  return Math.round((from - to) / (1000 * 60 * 60 * 24));
}

function inferFrequencia(vencimentos) {
  if (vencimentos.length < 2) return "semanal";
  const sorted = [...vencimentos].sort((x, y) => x.getTime() - y.getTime());
  const gap = diasEntre(sorted[0], sorted[1]);
  if (gap >= 1 && gap <= 2) return "diario";
  return "semanal";
}

async function main() {
  const emprestimos = await prisma.emprestimo.findMany({
    include: { parcelas: { select: { vencimento: true }, orderBy: { numero_parcela: "asc" }, take: 3 } }
  });

  let diarios = 0;
  for (const e of emprestimos) {
    const freq = inferFrequencia(e.parcelas.map((p) => p.vencimento));
    if (freq === "diario") diarios++;
    await prisma.emprestimo.update({
      where: { id: e.id },
      data: { frequencia_parcela: freq }
    });
  }

  console.log(`Atualizados ${emprestimos.length} empréstimos (${diarios} diários).`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
