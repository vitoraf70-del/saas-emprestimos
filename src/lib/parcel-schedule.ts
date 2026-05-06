import { addDays } from "date-fns";

/**
 * Ancora no calendário local (meio-dia) para evitar deslocar o dia por UTC/DST.
 */
export function toLocalCalendarDate(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0, 0);
}

/**
 * 1ª parcela = primeiro vencimento escolhido.
 * Cada parcela seguinte = data anterior + 7 dias (mesmo dia da semana).
 */
export function buildWeeklyInstallmentDueDates(primeiroVencimento: Date, quantidade: number): Date[] {
  const dates: Date[] = [];
  let cursor = toLocalCalendarDate(primeiroVencimento);
  for (let i = 0; i < quantidade; i++) {
    dates.push(new Date(cursor));
    cursor = addDays(cursor, 7);
  }
  return dates;
}
