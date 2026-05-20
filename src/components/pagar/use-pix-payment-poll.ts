"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const POLL_INTERVAL_MS = 5000;
const MAX_POLLS = 72;

export function usePixPaymentPoll(cpf?: string) {
  const router = useRouter();
  const [transactionId, setTransactionId] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [paid, setPaid] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const pollCount = useRef(0);

  const verificar = useCallback(async (txid: string) => {
    setChecking(true);
    try {
      const response = await fetch("/api/pix/verificar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactionId: txid })
      });
      const data = (await response.json()) as {
        baixado?: boolean;
        motivo?: string;
        statusBanco?: string;
      };

      if (data.baixado) {
        setPaid(true);
        setStatusMessage("Pagamento confirmado! Baixa automática realizada.");
        const qs = new URLSearchParams({ paid: "1" });
        if (cpf) qs.set("cpf", cpf);
        router.replace(`/pagar?${qs.toString()}`);
        router.refresh();
        return true;
      }

      if (data.motivo === "aguardando_pagamento") {
        setStatusMessage("Aguardando confirmação do PIX no banco...");
      }
    } catch {
      setStatusMessage("Não foi possível verificar o pagamento. Tentando novamente...");
    } finally {
      setChecking(false);
    }
    return false;
  }, [cpf, router]);

  useEffect(() => {
    if (!transactionId || paid) return;

    pollCount.current = 0;
    const tick = async () => {
      pollCount.current += 1;
      const done = await verificar(transactionId);
      if (done || pollCount.current >= MAX_POLLS) {
        clearInterval(timer);
        if (!done && pollCount.current >= MAX_POLLS) {
          setStatusMessage("Verificação automática encerrada. Se já pagou, aguarde alguns minutos ou recarregue a página.");
        }
      }
    };

    void tick();
    const timer = setInterval(() => void tick(), POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [transactionId, paid, verificar]);

  return {
    transactionId,
    setTransactionId,
    checking,
    paid,
    statusMessage,
    verificarManual: () => transactionId && verificar(transactionId)
  };
}
