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
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 16, 0, 0));
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
