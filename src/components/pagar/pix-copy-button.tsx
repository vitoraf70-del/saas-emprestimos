"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toCurrency } from "@/lib/utils";
import { usePixPaymentPoll } from "@/components/pagar/use-pix-payment-poll";

export function PixCopyButton({ parcelaId, cpf }: { parcelaId: string; cpf?: string }) {
  const [loading, setLoading] = useState(false);
  const [code, setCode] = useState("");
  const [valor, setValor] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const poll = usePixPaymentPoll(cpf);

  async function generatePix() {
    setLoading(true);
    setError("");
    poll.setTransactionId(null);
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
    setCopied(false);
    if (data.transactionId) {
      poll.setTransactionId(String(data.transactionId));
    }
  }

  async function copyPixCode() {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setError("");
    } catch {
      setError("Não foi possível copiar o código PIX.");
    }
  }

  return (
    <div className="space-y-2">
      <Button type="button" className="w-full" onClick={generatePix} disabled={loading || poll.paid}>
        {loading ? "Gerando PIX..." : poll.paid ? "Parcela paga" : "Gerar PIX Copia e Cola"}
      </Button>
      {valor !== null ? <p className="text-xs text-muted-foreground">Valor atualizado: {toCurrency(valor)}</p> : null}
      {code ? (
        <>
          <Button type="button" variant="outline" className="w-full" onClick={copyPixCode}>
            {copied ? "Código PIX copiado!" : "Copiar código PIX"}
          </Button>
          <textarea className="w-full rounded-md border p-2 text-xs" rows={4} readOnly value={code} />
        </>
      ) : null}
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
