import { calcularParcelaComIsencao, calendarDayKeyBR, diasAtraso } from "@/lib/finance";
import { syncEmprestimoStatus } from "@/lib/emprestimo-status";
import { prisma } from "@/lib/prisma";

/**
 * Cortesia pontual: a cobrança automática ficou fora do ar de 28/06 a 02/07/2026.
 * As parcelas que venceram nesse período (30/06 a 02/07) tiveram multa/juros
 * retirados manualmente, com prazo de tolerância até o fim de 04/07. A partir de
 * 05/07, quem ainda não pagou volta a ser cobrado normalmente.
 *
 * Esta função roda dentro do cron diário (nuvem) e é idempotente: depois de
 * reativar as parcelas, as próximas execuções não encontram nada e não fazem
 * nada. Não afeta nenhuma parcela fora desta janela fixa.
 */
const JANELA_INICIO = new Date("2026-06-30T00:00:00-04:00");
const JANELA_FIM = new Date("2026-07-03T00:00:00-04:00"); // exclusivo (até 02/07)
const APLICAR_A_PARTIR_DE = "2026-07-05";

export type ExpirarCortesiaResult = {
  aplicado: boolean;
  reativadas: number;
  motivo?: string;
};

export async function expirarCortesiaEncargos(): Promise<ExpirarCortesiaResult> {
  const hoje = new Date();
  const hojeKey = calendarDayKeyBR(hoje);

  if (hojeKey < APLICAR_A_PARTIR_DE) {
    return { aplicado: false, reativadas: 0, motivo: "dentro do prazo de tolerância" };
  }

  const parcelas = await prisma.parcela.findMany({
    where: {
      vencimento: { gte: JANELA_INICIO, lt: JANELA_FIM },
      encargos_isentos: true,
      status: { in: ["pendente", "vencida"] }
    },
    select: {
      id: true,
      valor_original: true,
      vencimento: true,
      emprestimo_id: true,
      emprestimo: { select: { frequencia_parcela: true } }
    }
  });

  if (parcelas.length === 0) {
    return { aplicado: false, reativadas: 0, motivo: "nada a reativar" };
  }

  const emprestimos = new Set<string>();

  for (const parcela of parcelas) {
    const dias = diasAtraso(parcela.vencimento, hoje);
    const calc = calcularParcelaComIsencao(
      Number(parcela.valor_original),
      dias,
      parcela.emprestimo.frequencia_parcela,
      false,
      false
    );

    await prisma.parcela.updateMany({
      where: { id: parcela.id, status: { in: ["pendente", "vencida"] } },
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

    emprestimos.add(parcela.emprestimo_id);
  }

  for (const id of emprestimos) await syncEmprestimoStatus(id);

  return { aplicado: true, reativadas: parcelas.length };
}
