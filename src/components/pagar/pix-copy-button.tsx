"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toCurrency } from "@/lib/utils";

export function PixCopyButton({ parcelaId }: { parcelaId: string }) {
  const [loading, setLoading] = useState(false);
  const [code, setCode] = useState("");
  const [valor, setValor] = useState<number | null>(null);
  const [error, setError] = useState("");

  async function generatePix() {
    setLoading(true);
    setError("");
    const response = await fetch("/api/pix/copy-paste", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ parcelaId })
    });

    const data = await response.json();
    setLoading(false);
    if (!response.ok) {
      setError(data?.error ?? "Não foi possível gerar PIX.");
      return;
    }

    setCode(data.copyPasteCode);
    setValor(Number(data.valorAtualizado));
  }

  return (
    <div className="space-y-2">
      <Button type="button" className="w-full" onClick={generatePix} disabled={loading}>
        {loading ? "Gerando PIX..." : "Gerar PIX Copia e Cola"}
      </Button>
      {valor !== null ? <p className="text-xs text-muted-foreground">Valor atualizado: {toCurrency(valor)}</p> : null}
      {code ? <textarea className="w-full rounded-md border p-2 text-xs" rows={4} readOnly value={code} /> : null}
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
