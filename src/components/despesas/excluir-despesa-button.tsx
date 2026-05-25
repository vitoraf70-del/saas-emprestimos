"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function ExcluirDespesaButton({ id, descricao }: { id: string; descricao: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function excluir() {
    if (!window.confirm(`Excluir a despesa "${descricao}" e todas as parcelas?`)) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/despesas/${id}`, { method: "DELETE" });
      if (response.ok) router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button type="button" variant="outline" size="sm" disabled={loading} onClick={excluir}>
      {loading ? "..." : "Excluir"}
    </Button>
  );
}
