"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatBrazilPhone, normalizeBrazilPhone } from "@/lib/utils";

export function NovoClienteModal() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [whatsApp, setWhatsApp] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const form = event.currentTarget;
    const data = new FormData(form);
    const payload = Object.fromEntries(data.entries()) as Record<string, string>;

    const whatsappNormalizado = normalizeBrazilPhone(payload.whatsapp ?? whatsApp);
    if (!whatsappNormalizado) {
      setLoading(false);
      setError("WhatsApp inválido. Digite os 11 números, ex.: (67) 99999-9999.");
      return;
    }
    payload.whatsapp = whatsappNormalizado;

    try {
      const response = await fetch("/api/clientes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(body?.error ?? "Não foi possível salvar o cliente.");
        return;
      }

      setOpen(false);
      setWhatsApp("");
      form.reset();
      router.refresh();
    } catch {
      setError("Erro de conexão. Verifique a internet e tente de novo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}>
        Novo cliente
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cadastrar cliente</DialogTitle>
          </DialogHeader>

          <form onSubmit={onSubmit} className="grid gap-2 md:grid-cols-2">
            <input required name="nome" placeholder="Nome" className="rounded-md border p-2" />
            <input required name="cpf" placeholder="CPF" className="rounded-md border p-2" />
            <input required name="endereco" placeholder="Endereço" className="rounded-md border p-2 md:col-span-2" />
            <input
              required
              name="whatsapp"
              placeholder="(67) 99999-9999"
              className="rounded-md border p-2"
              value={whatsApp}
              onChange={(e) => setWhatsApp(formatBrazilPhone(e.target.value))}
              inputMode="numeric"
              title="Digite DDD + número com 9 dígitos"
            />
            <input name="referencia1_nome" placeholder="Referência 1 (nome)" className="rounded-md border p-2" />
            <input name="referencia1_telefone" placeholder="Referência 1 (telefone)" className="rounded-md border p-2" />
            <input name="referencia2_nome" placeholder="Referência 2 (nome)" className="rounded-md border p-2" />
            <input name="referencia2_telefone" placeholder="Referência 2 (telefone)" className="rounded-md border p-2" />
            {error ? (
              <p className="md:col-span-2 text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}
            <Button type="submit" className="md:col-span-2" disabled={loading}>
              {loading ? "Salvando..." : "Salvar cliente"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
