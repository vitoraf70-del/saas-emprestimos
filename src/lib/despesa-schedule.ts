import { dateFromCalendarDayKey } from "@/lib/finance";

/** Soma meses em chave yyyy-MM-dd (calendário BR). */
export function addMonthsToDayKey(dayKey: string, months: number) {
  const [y, m, d] = dayKey.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1 + months, d));
  const yy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export function buildDespesaVencimentos(primeiroDayKey: string, quantidade: number) {
  return Array.from({ length: quantidade }, (_, i) =>
    dateFromCalendarDayKey(addMonthsToDayKey(primeiroDayKey, i))!
  );
}

/** Divide valor total em N parcelas (ajusta centavos na última). */
export function splitValorEmParcelas(valorTotal: number, quantidade: number) {
  const n = Math.max(1, quantidade);
  const totalCentavos = Math.round(valorTotal * 100);
  const base = Math.floor(totalCentavos / n);
  const resto = totalCentavos - base * n;
  return Array.from({ length: n }, (_, i) => {
    const centavos = base + (i === n - 1 ? resto : 0);
    return centavos / 100;
  });
}
