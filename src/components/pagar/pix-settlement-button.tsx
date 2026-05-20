"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toCurrency } from "@/lib/utils";
import { usePixPaymentPoll } from "@/components/pagar/use-pix-payment-poll";

type PixSettlementButtonProps = {
  parcelaIds: string[];
  cpf?: string;
};

export function PixSettlementButton({ parcelaIds, cpf }: PixSettlementButtonProps) {
  const [loading, setLoading] = useState(false);
  const [code, setCode] = useState("");
  const [valorTotal, setValorTotal] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const poll = usePixPaymentPoll(cpf);

  async function generatePixTotal() {
    setLoading(true);
    setError("");
    poll.setTransactionId(null);
    try {
      const response = await fetch("/api/pix/copy-paste-total", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parcelaIds })
      });

      let data: { error?: string; copyPasteCode?: string; valorTotal?: number; transactionId?: string } | null = null;
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
      if (data?.transactionId) {
        poll.setTransactionId(String(data.transactionId));
      }
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
      <Button
        type="button"
        className="w-full"
        onClick={generatePixTotal}
        disabled={loading || parcelaIds.length === 0 || poll.paid}
      >
        {loading ? "Gerando PIX..." : poll.paid ? "Pagamento confirmado" : "Quitar parcelas (PIX único)"}
      </Button>
      {valorTotal !== null ? <p className="text-xs text-muted-foreground">Total atualizado: {toCurrency(valorTotal)}</p> : null}
      {code ? (
        <Button type="button" variant="outline" className="w-full" onClick={copyPixCode}>
          {copied ? "Código PIX copiado!" : "Copiar código PIX"}
        </Button>
      ) : null}
      {code ? <textarea className="w-full rounded-md border p-2 text-xs" rows={4} readOnly value={code} /> : null}
      {poll.transactionId && !poll.paid ? (
        <Button type="button" variant="outline" className="w-full" onClick={() => void poll.verificarManual()} disabled={poll.checking}>
          {poll.checking ? "Verificando pagamento..." : "Já paguei — verificar agora"}
        </Button>
      ) : null}
      {poll.statusMessage ? (
        <p className={`text-xs ${poll.paid ? "text-emerald-700" : "text-muted-foreground"}`}>{poll.statusMessage}</p>
      ) : null}
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
