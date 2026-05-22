"use client";

import { useCallback, useState } from "react";

export type ClienteOption = {
  id: string;
  nome: string;
  cpf: string;
};

export function useClientesOptions() {
  const [clientes, setClientes] = useState<ClienteOption[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (clientes.length > 0) return clientes;
    setLoading(true);
    try {
      const response = await fetch("/api/clientes/options");
      if (!response.ok) throw new Error("Falha ao carregar clientes");
      const data = (await response.json()) as ClienteOption[];
      setClientes(data);
      return data;
    } finally {
      setLoading(false);
    }
  }, [clientes.length]);

  return { clientes, loading, load };
}
