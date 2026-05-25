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
    setLoading(true);
    try {
      const response = await fetch("/api/clientes/options", { cache: "no-store" });
      if (!response.ok) throw new Error("Falha ao carregar clientes");
      const data = (await response.json()) as ClienteOption[];
      setClientes(data);
      return data;
    } finally {
      setLoading(false);
    }
  }, []);

  return { clientes, loading, load };
}
