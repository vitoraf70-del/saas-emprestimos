"use client";

import { FormEvent, useMemo, useState } from "react";

function formatCpf(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

export function CpfSearchForm({ initialCpf }: { initialCpf: string }) {
  const [cpf, setCpf] = useState(initialCpf);
  const digitsCount = useMemo(() => cpf.replace(/\D/g, "").length, [cpf]);
  const showInvalid = digitsCount > 0 && digitsCount < 11;

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    if (showInvalid) {
      event.preventDefault();
    }
  }

  return (
    <form method="GET" className="mb-4 space-y-2" onSubmit={onSubmit}>
      <input
        name="cpf"
        value={cpf}
        onChange={(e) => setCpf(formatCpf(e.target.value))}
        placeholder="Digite seu CPF"
        className="w-full rounded-md border p-3 text-base"
        inputMode="numeric"
      />
      {showInvalid ? <p className="text-xs text-red-600">CPF inválido. Digite os 11 números.</p> : null}
      <button className="w-full rounded-md bg-primary p-3 text-sm font-medium text-primary-foreground">
        Buscar parcelas
      </button>
    </form>
  );
}
