import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function toCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  }).format(value);
}

/** Máscara (67) 99999-9999 para inputs de telefone. */
export function formatBrazilPhone(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  const ddd = digits.slice(0, 2);
  const first = digits.slice(2, 7);
  const second = digits.slice(7, 11);

  if (!ddd) return "";
  if (digits.length <= 2) return `(${ddd}`;
  if (digits.length <= 7) return `(${ddd}) ${first}`;
  return `(${ddd}) ${first}-${second}`;
}

/** Aceita com ou sem máscara; retorna formato do banco ou null se inválido. */
export function normalizeBrazilPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 11) return null;
  return formatBrazilPhone(digits);
}
