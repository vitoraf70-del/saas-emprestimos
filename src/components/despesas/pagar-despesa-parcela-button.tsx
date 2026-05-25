"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function PagarDespesaParcelaButton({ id, paga }: { id: string; paga: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function toggle() {
    setLoading(true);
    try {
      await fetch(`/api/despesas/parcelas/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: paga ? "pendente" : "paga" })
      });
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button type="button" variant={paga ? "outline" : "default"} size="sm" disabled={loading} onClick={toggle}>
      {loading ? "..." : paga ? "Desfazer" : "Pagar"}
    </Button>
  );
}
