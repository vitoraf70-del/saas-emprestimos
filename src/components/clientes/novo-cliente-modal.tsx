"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

function formatPhone(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  const ddd = digits.slice(0, 2);
  const first = digits.slice(2, 7);
  const second = digits.slice(7, 11);

  if (!ddd) return "";
  if (digits.length <= 2) return `(${ddd}`;
  if (digits.length <= 7) return `(${ddd}) ${first}`;
  return `(${ddd}) ${first}-${second}`;
}

export function NovoClienteModal() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [whatsApp, setWhatsApp] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);

    const form = event.currentTarget;
    const data = new FormData(form);
    const payload = Object.fromEntries(data.entries());

    const response = await fetch("/api/clientes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    setLoading(false);
    if (!response.ok) return;

    setOpen(false);
    setWhatsApp("");
    form.reset();
    router.refresh();
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
              onChange={(e) => setWhatsApp(formatPhone(e.target.value))}
              inputMode="numeric"
              pattern="\(\d{2}\)\s\d{5}-\d{4}"
              title="Use o formato (67) 99999-9999"
            />
            <input name="referencia1_nome" placeholder="Referência 1 (nome)" className="rounded-md border p-2" />
            <input name="referencia1_telefone" placeholder="Referência 1 (telefone)" className="rounded-md border p-2" />
            <input name="referencia2_nome" placeholder="Referência 2 (nome)" className="rounded-md border p-2" />
            <input name="referencia2_telefone" placeholder="Referência 2 (telefone)" className="rounded-md border p-2" />
            <Button type="submit" className="md:col-span-2" disabled={loading}>
              {loading ? "Salvando..." : "Salvar cliente"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
