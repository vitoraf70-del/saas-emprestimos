/** Multa fixa por parcela em atraso (R$). */
export const MULTA_ATRASO_FIXA = 50;
/** Mora diária por parcela em atraso (R$/dia). */
export const JUROS_DIA_FIXO = 20;

const DAILY_MS = 1000 * 60 * 60 * 24;
const BR_TIMEZONE = "America/Sao_Paulo";

function calendarDayKey(date: Date, timeZone = BR_TIMEZONE) {
  return date.toLocaleDateString("en-CA", { timeZone });
}

/** Dias até o vencimento (calendário BR): 2 = vence daqui 2 dias, 0 = vence hoje, negativo = já venceu. */
export function diasParaVencer(vencimento: Date, hoje = new Date()) {
  const vKey = calendarDayKey(vencimento);
  const hKey = calendarDayKey(hoje);
  const v = new Date(`${vKey}T12:00:00`);
  const h = new Date(`${hKey}T12:00:00`);
  return Math.round((v.getTime() - h.getTime()) / DAILY_MS);
}

export function diasAtraso(vencimento: Date, hoje = new Date()) {
  return Math.max(0, -diasParaVencer(vencimento, hoje));
}

export function isSameCalendarDayBR(a: Date, b: Date) {
  return calendarDayKey(a) === calendarDayKey(b);
}

export function calcularParcelaAtualizada(
  valorOriginal: number,
  dias: number
) {
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
