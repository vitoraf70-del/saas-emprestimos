"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function RetirarEncargosButton({
  id,
  clienteNome,
  numeroParcela,
  valorOriginal,
  multa,
  juros
}: {
  id: string;
  clienteNome: string;
  numeroParcela: number;
  valorOriginal: string;
  multa: string;
  juros: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function retirarEncargos() {
    const ok = window.confirm(
      `Retirar multa (${multa}) e juros (${juros}) da parcela ${numeroParcela} de ${clienteNome}? O valor ficará ${valorOriginal}.`
    );
    if (!ok) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/parcelas/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "isentar_encargos" })
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        window.alert(body?.error ?? "Não foi possível retirar multa e juros.");
        return;
      }

      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button type="button" variant="outline" size="sm" disabled={loading} onClick={retirarEncargos}>
      {loading ? "..." : "Retirar multa e juros"}
    </Button>
  );
}
