"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toCurrency } from "@/lib/utils";

type PixSettlementButtonProps = {
  parcelaIds: string[];
};

export function PixSettlementButton({ parcelaIds }: PixSettlementButtonProps) {
  const [loading, setLoading] = useState(false);
  const [code, setCode] = useState("");
  const [valorTotal, setValorTotal] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  async function generatePixTotal() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/pix/copy-paste-total", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parcelaIds })
      });

      let data: { error?: string; copyPasteCode?: string; valorTotal?: number } | null = null;
      try {
        data = await response.json();
      } catch {
        data = null;
      }

      if (!response.ok) {
        setError(data?.error ?? "Não foi possível gerar PIX da quitação.");
        return;
      }

      setCode(data?.copyPasteCode ?? "");
      setValorTotal(Number(data?.valorTotal ?? 0));
      setCopied(false);
    } catch {
      setError("Falha de conexão ao gerar PIX da quitação.");
    } finally {
      setLoading(false);
    }
  }

  async function copyPixCode() {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {
      setError("Não foi possível copiar o código PIX.");
    }
  }

  return (
    <div className="space-y-2 rounded-lg border p-3">
      <Button type="button" className="w-full" onClick={generatePixTotal} disabled={loading || parcelaIds.length === 0}>
        {loading ? "Gerando PIX..." : "Quitar parcelas (PIX único)"}
      </Button>
      {valorTotal !== null ? <p className="text-xs text-muted-foreground">Total atualizado: {toCurrency(valorTotal)}</p> : null}
      {code ? (
        <Button type="button" variant="outline" className="w-full" onClick={copyPixCode}>
          {copied ? "Código PIX copiado!" : "Copiar código PIX"}
        </Button>
      ) : null}
      {code ? <textarea className="w-full rounded-md border p-2 text-xs" rows={4} readOnly value={code} /> : null}
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
