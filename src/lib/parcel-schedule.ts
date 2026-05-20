import { addDays } from "date-fns";
import { anchorVencimentoCampoGrande } from "@/lib/finance";

/**
 * Ancora o vencimento no calendário de Campo Grande (evita virar dia errado em UTC).
 */
export function toLocalCalendarDate(date: Date): Date {
  return anchorVencimentoCampoGrande(date);
}

export function isDomingo(date: Date) {
  return toLocalCalendarDate(date).getDay() === 0;
}

/** Se cair no domingo, move para segunda-feira. */
export function ajustarVencimentoDiaUtil(date: Date) {
  const d = toLocalCalendarDate(date);
  if (isDomingo(d)) return addDays(d, 1);
  return d;
}

/** Próximo dia de vencimento diário: avança 1 dia e pula domingo. */
function proximoVencimentoDiario(date: Date) {
  let cursor = addDays(toLocalCalendarDate(date), 1);
  while (isDomingo(cursor)) {
    cursor = addDays(cursor, 1);
  }
  return cursor;
}

function buildDailyInstallmentDueDatesMonSat(primeiroVencimento: Date, quantidade: number): Date[] {
  const dates: Date[] = [];
  let cursor = ajustarVencimentoDiaUtil(primeiroVencimento);

  for (let i = 0; i < quantidade; i++) {
    dates.push(new Date(cursor));
    if (i < quantidade - 1) {
      cursor = proximoVencimentoDiario(cursor);
    }
  }

  return dates;
}

/**
 * 1ª parcela = primeiro vencimento escolhido.
 * Cada parcela seguinte = data anterior + 7 dias (mesmo dia da semana).
 */
export function buildWeeklyInstallmentDueDates(primeiroVencimento: Date, quantidade: number): Date[] {
  return buildInstallmentDueDates(primeiroVencimento, quantidade, "semanal");
}

export type FrequenciaParcela = "diario" | "semanal";

export function buildInstallmentDueDates(
  primeiroVencimento: Date,
  quantidade: number,
  frequencia: FrequenciaParcela
): Date[] {
  if (frequencia === "diario") {
    return buildDailyInstallmentDueDatesMonSat(primeiroVencimento, quantidade);
  }

  const dates: Date[] = [];
  let cursor = toLocalCalendarDate(primeiroVencimento);
  for (let i = 0; i < quantidade; i++) {
    dates.push(new Date(cursor));
    cursor = addDays(cursor, 7);
  }
  return dates;
}
