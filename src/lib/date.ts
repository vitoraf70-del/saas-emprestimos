import { format, isValid, parse } from "date-fns";
import { ptBR } from "date-fns/locale";

export function formatDateBR(date: Date) {
  return format(date, "dd/MM/yyyy", { locale: ptBR });
}

export function formatDateWithWeekdayBR(date: Date) {
  return `${format(date, "dd/MM/yyyy", { locale: ptBR })} (${format(date, "EEEE", {
    locale: ptBR
  })})`;
}

export function parseDateFromInput(value: string) {
  const trimmed = value.trim();
  const parsedBR = parse(trimmed, "dd/MM/yyyy", new Date(), { locale: ptBR });
  if (isValid(parsedBR)) return parsedBR;

  const parsedISO = parse(trimmed, "yyyy-MM-dd", new Date());
  if (isValid(parsedISO)) return parsedISO;

  return null;
}

export function formatDateMask(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}
