/** Multa fixa por parcela em atraso (R$). */
export const MULTA_ATRASO_FIXA = 50;
/** Mora diária por parcela em atraso (R$/dia). */
export const JUROS_DIA_FIXO = 20;

const DAILY_MS = 1000 * 60 * 60 * 24;
/** Campo Grande (MS) — UTC−4 */
export const BR_TIMEZONE = "America/Campo_Grande";

export function calendarDayKeyBR(date: Date, timeZone = BR_TIMEZONE) {
  return date.toLocaleDateString("en-CA", { timeZone });
}

/** Grava o vencimento no meio-dia em Campo Grande para não virar dia anterior no banco (UTC). */
export function anchorVencimentoCampoGrande(date: Date) {
  const key = calendarDayKeyBR(date);
  return dateFromCalendarDayKey(key)!;
}

/** Garante Date de vencimento ancorado no dia do calendário de Campo Grande. */
export function normalizeVencimento(date: Date) {
  return dateFromCalendarDayKey(calendarDayKeyBR(date))!;
}

/** Converte yyyy-MM-dd para meio-dia em Campo Grande (ISO com offset fixo). */
export function dateFromCalendarDayKey(dayKey: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dayKey.trim());
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  if (!y || m < 1 || m > 12 || d < 1 || d > 31) return null;
  return new Date(`${match[1]}-${match[2]}-${match[3]}T12:00:00-04:00`);
}

export function shiftCalendarDayKey(dayKey: string, days: number) {
  const [y, m, d] = dayKey.split("-").map(Number);
  const utc = Date.UTC(y, m - 1, d) + days * DAILY_MS;
  const date = new Date(utc);
  const yy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

/** Extrai yyyy-MM-dd de input ISO, BR ou date picker. */
export function extractCalendarDayKey(value: string): string | null {
  const trimmed = value.trim();
  const isoPrefix = /^(\d{4}-\d{2}-\d{2})/.exec(trimmed);
  if (isoPrefix) return isoPrefix[1];

  const brMatch = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(trimmed);
  if (brMatch) {
    const [, dd, mm, yyyy] = brMatch;
    return `${yyyy}-${mm}-${dd}`;
  }

  return null;
}

export function tomorrowCalendarDayKeyBR(hoje = new Date()) {
  return shiftCalendarDayKey(calendarDayKeyBR(hoje), 1);
}

/** Soma dias no calendário BR sem depender do fuso do servidor. */
export function addCalendarDays(date: Date, days: number): Date {
  const key = calendarDayKeyBR(date);
  return dateFromCalendarDayKey(shiftCalendarDayKey(key, days))!;
}

export function weekdayFromCalendarDayKey(dayKey: string) {
  const [y, m, d] = dayKey.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function diasEntreCalendarioBR(a: Date, b: Date) {
  return diasEntreChavesCalendario(calendarDayKeyBR(a), calendarDayKeyBR(b));
}

function diasEntreChavesCalendario(fromKey: string, toKey: string) {
  const [y1, m1, d1] = fromKey.split("-").map(Number);
  const [y2, m2, d2] = toKey.split("-").map(Number);
  const from = Date.UTC(y1, m1 - 1, d1);
  const to = Date.UTC(y2, m2 - 1, d2);
  return Math.round((from - to) / DAILY_MS);
}

/**
 * Dias até o vencimento (calendário Campo Grande):
 * 1 = vence amanhã, 0 = vence hoje, negativo = já passou do vencimento.
 */
export function diasParaVencer(vencimento: Date, hoje = new Date()) {
  return diasEntreChavesCalendario(calendarDayKeyBR(vencimento), calendarDayKeyBR(hoje));
}

/** Só conta atraso após o dia do vencimento (vence hoje = 0 dias de atraso). */
export function diasAtraso(vencimento: Date, hoje = new Date()) {
  const dias = diasParaVencer(vencimento, hoje);
  return dias < 0 ? -dias : 0;
}

export function isSameCalendarDayBR(a: Date, b: Date) {
  return calendarDayKeyBR(a) === calendarDayKeyBR(b);
}

export function calcularParcelaAtualizada(valorOriginal: number, dias: number) {
  if (dias <= 0) {
    return {
      diasAtraso: 0,
      multaValor: 0,
      jurosValor: 0,
      valorAtualizado: valorOriginal
    };
  }

  const multaValor = MULTA_ATRASO_FIXA;
  const jurosValor = JUROS_DIA_FIXO * dias;
  const valorAtualizado = valorOriginal + multaValor + jurosValor;

  return {
    diasAtraso: dias,
    multaValor,
    jurosValor,
    valorAtualizado
  };
}
