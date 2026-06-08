"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function MarcarParcelaPagaButton({
  id,
  clienteNome,
  numeroParcela,
  valor
}: {
  id: string;
  clienteNome: string;
  numeroParcela: number;
  valor: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function marcarPaga() {
    const ok = window.confirm(
      `Confirmar baixa da parcela ${numeroParcela} de ${clienteNome} no valor de ${valor}?`
    );
    if (!ok) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/parcelas/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "paga" })
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        window.alert(body?.error ?? "Não foi possível dar baixa na parcela.");
        return;
      }

      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button type="button" size="sm" disabled={loading} onClick={marcarPaga}>
      {loading ? "..." : "Parcela paga"}
    </Button>
  );
}
