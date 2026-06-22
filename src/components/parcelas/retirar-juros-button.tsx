"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function RetirarJurosButton({
  id,
  clienteNome,
  numeroParcela,
  juros,
  valorSemJuros
}: {
  id: string;
  clienteNome: string;
  numeroParcela: number;
  juros: string;
  valorSemJuros: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function retirarJuros() {
    const ok = window.confirm(
      `Retirar juros de atraso (${juros}) da parcela ${numeroParcela} de ${clienteNome}? O valor ficará ${valorSemJuros}.`
    );
    if (!ok) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/parcelas/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "isentar_juros" })
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        window.alert(body?.error ?? "Não foi possível retirar os juros de atraso.");
        return;
      }

      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button type="button" variant="outline" size="sm" disabled={loading} onClick={retirarJuros}>
      {loading ? "..." : "Retirar juros"}
    </Button>
  );
}
