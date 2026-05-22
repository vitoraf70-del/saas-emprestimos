import { format, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  calendarDayKeyBR,
  dateFromCalendarDayKey,
  extractCalendarDayKey,
  weekdayFromCalendarDayKey
} from "@/lib/finance";

export function formatDateBR(date: Date) {
  if (!date || !isValid(date)) return "—";
  const key = calendarDayKeyBR(date);
  const [y, m, d] = key.split("-");
  return `${d}/${m}/${y}`;
}

export function formatDateWithWeekdayBR(date: Date) {
  if (!date || !isValid(date)) return "—";
  const key = calendarDayKeyBR(date);
  const anchored = dateFromCalendarDayKey(key);
  if (!anchored) return "—";
  const weekday = weekdayFromCalendarDayKey(key);
  const weekdayLabel = format(
    new Date(Date.UTC(2024, 0, 7 + weekday)),
    "EEEE",
    { locale: ptBR }
  );
  return `${formatDateBR(date)} (${weekdayLabel})`;
}

export function parseDateFromInput(value: string) {
  const key = extractCalendarDayKey(value);
  if (!key) return null;
  return dateFromCalendarDayKey(key);
}

export function formatDateMask(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}
