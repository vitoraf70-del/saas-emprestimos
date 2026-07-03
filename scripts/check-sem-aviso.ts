import { PrismaClient } from "@prisma/client";
import {
  calendarDayKeyBR,
  diasAtraso,
  diasParaVencer,
  isSameCalendarDayBR
} from "../src/lib/finance";
import { formatDateBR } from "../src/lib/date";

const prisma = new PrismaClient();

// Quantos dias sem aviso para considerar "esquecido" (default 1 = qualquer parcela
// devida hoje/atrasada que não recebeu aviso hoje). Pode passar por argumento.
const DIAS_SEM_AVISO = Number(process.argv[2] ?? "1");

async function main() {
  const hoje = new Date();
  const hojeKey = calendarDayKeyBR(hoje);

  const parcelas = await prisma.parcela.findMany({
    where: {
      status: { in: ["pendente", "vencida"] }
    },
    include: {
      emprestimo: {
        select: {
          frequencia_parcela: true,
          cliente: { select: { nome: true, whatsapp: true } }
        }
      }
    },
    orderBy: { vencimento: "asc" }
  });

  type Linha = {
    nome: string;
    whatsapp: string;
    parcela: number;
    vencimento: string;
    situacao: string;
    diasAtraso: number;
    diasParaVencer: number;
    ultimoAviso: string;
    diasSemAviso: number | null;
  };

  const semAviso: Linha[] = [];

  for (const p of parcelas) {
    const dAtraso = diasAtraso(p.vencimento, hoje);
    const dParaVencer = diasParaVencer(p.vencimento, hoje);

    // Só interessa quem já venceu ou vence hoje (é aí que a cobrança importa).
    const devidoHojeOuAtrasado = dParaVencer <= 0;
    if (!devidoHojeOuAtrasado) continue;

    const avisadoHoje = p.ultimo_aviso_em
      ? isSameCalendarDayBR(p.ultimo_aviso_em, hoje)
      : false;
    if (avisadoHoje) continue;

    const diasSemAviso = p.ultimo_aviso_em
      ? Math.round(
          (Date.parse(hojeKey) - Date.parse(calendarDayKeyBR(p.ultimo_aviso_em))) /
            (1000 * 60 * 60 * 24)
        )
      : null;

    // Filtro: nunca avisado, ou último aviso há >= DIAS_SEM_AVISO dias.
    if (diasSemAviso !== null && diasSemAviso < DIAS_SEM_AVISO) continue;

    semAviso.push({
      nome: p.emprestimo.cliente.nome,
      whatsapp: p.emprestimo.cliente.whatsapp,
      parcela: p.numero_parcela,
      vencimento: formatDateBR(p.vencimento),
      situacao: dAtraso > 0 ? `atrasada ${dAtraso}d` : "vence hoje",
      diasAtraso: dAtraso,
      diasParaVencer: dParaVencer,
      ultimoAviso: p.ultimo_aviso_em ? formatDateBR(p.ultimo_aviso_em) : "NUNCA",
      diasSemAviso
    });
  }

  // Agrupa por cliente para leitura.
  const porCliente = new Map<string, Linha[]>();
  for (const l of semAviso) {
    const key = `${l.nome} — ${l.whatsapp}`;
    if (!porCliente.has(key)) porCliente.set(key, []);
    porCliente.get(key)!.push(l);
  }

  console.log(`Hoje: ${hojeKey}`);
  console.log(`Filtro: parcelas devidas/atrasadas sem aviso há >= ${DIAS_SEM_AVISO} dia(s)\n`);
  console.log(`Clientes que ficaram sem mensagem: ${porCliente.size}`);
  console.log(`Parcelas sem aviso: ${semAviso.length}\n`);

  const ordenados = [...porCliente.entries()].sort((a, b) => {
    const maxA = Math.max(...a[1].map((l) => l.diasAtraso));
    const maxB = Math.max(...b[1].map((l) => l.diasAtraso));
    return maxB - maxA;
  });

  for (const [cliente, linhas] of ordenados) {
    console.log(`\n${cliente}`);
    for (const l of linhas) {
      console.log(
        `  parcela ${l.parcela} | venc ${l.vencimento} | ${l.situacao} | último aviso: ${l.ultimoAviso}` +
          (l.diasSemAviso !== null ? ` (${l.diasSemAviso}d atrás)` : "")
      );
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
