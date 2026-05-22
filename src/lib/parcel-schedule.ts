import {
  addCalendarDays,
  anchorVencimentoCampoGrande,
  calendarDayKeyBR,
  dateFromCalendarDayKey,
  shiftCalendarDayKey,
  weekdayFromCalendarDayKey
} from "@/lib/finance";

/**
 * Ancora o vencimento no calendário de Campo Grande (evita virar dia errado em UTC).
 */
export function toLocalCalendarDate(date: Date): Date {
  return anchorVencimentoCampoGrande(date);
}

export function isDomingo(date: Date) {
  return weekdayFromCalendarDayKey(calendarDayKeyBR(date)) === 0;
}

/** Se cair no domingo, move para segunda-feira. */
export function ajustarVencimentoDiaUtil(date: Date) {
  const d = toLocalCalendarDate(date);
  if (isDomingo(d)) return addCalendarDays(d, 1);
  return d;
}

/** Próximo dia de vencimento diário: avança 1 dia e pula domingo. */
function proximoVencimentoDiario(date: Date) {
  let cursor = addCalendarDays(toLocalCalendarDate(date), 1);
  while (isDomingo(cursor)) {
    cursor = addCalendarDays(cursor, 1);
  }
  return cursor;
}

function buildDailyInstallmentDueDatesMonSat(primeiroVencimento: Date, quantidade: number): Date[] {
  const dates: Date[] = [];
  let cursor = ajustarVencimentoDiaUtil(primeiroVencimento);

  for (let i = 0; i < quantidade; i++) {
    dates.push(toLocalCalendarDate(cursor));
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
export type FrequenciaParcela = "diario" | "semanal";

export function buildWeeklyInstallmentDueDates(primeiroVencimento: Date, quantidade: number): Date[] {
  return buildInstallmentDueDates(primeiroVencimento, quantidade, "semanal");
}

/** Monta vencimentos a partir de yyyy-MM-dd (sem conversão de fuso no servidor). */
export function buildInstallmentDueDatesFromDayKey(
  primeiroDayKey: string,
  quantidade: number,
  frequencia: FrequenciaParcela
): Date[] {
  if (frequencia === "diario") {
    const primeiro = dateFromCalendarDayKey(primeiroDayKey);
    if (!primeiro) return [];
    return buildDailyInstallmentDueDatesMonSat(primeiro, quantidade);
  }

  return Array.from({ length: quantidade }, (_, i) =>
    dateFromCalendarDayKey(shiftCalendarDayKey(primeiroDayKey, i * 7))!
  );
}

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
    dates.push(toLocalCalendarDate(cursor));
    cursor = addCalendarDays(cursor, 7);
  }
  return dates;
}
