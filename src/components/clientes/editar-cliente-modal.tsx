"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
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

type ClienteSnapshot = {
  id: string;
  nome: string;
  cpf: string;
  endereco: string;
  whatsapp: string;
  referencia1_nome: string | null;
  referencia1_telefone: string | null;
  referencia2_nome: string | null;
  referencia2_telefone: string | null;
};

export function EditarClienteModal({ cliente }: { cliente: ClienteSnapshot }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [whatsApp, setWhatsApp] = useState(cliente.whatsapp);

  const defaults = useMemo(
    () => ({
      nome: cliente.nome,
      cpf: cliente.cpf,
      endereco: cliente.endereco,
      referencia1_nome: cliente.referencia1_nome ?? "",
      referencia1_telefone: cliente.referencia1_telefone ?? "",
      referencia2_nome: cliente.referencia2_nome ?? "",
      referencia2_telefone: cliente.referencia2_telefone ?? ""
    }),
    [cliente]
  );

  useEffect(() => {
    if (!open) return;
    setWhatsApp(cliente.whatsapp);
  }, [open, cliente.whatsapp]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const form = event.currentTarget;
    const data = new FormData(form);
    const payload = Object.fromEntries(data.entries());

    const response = await fetch(`/api/clientes/${cliente.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    setLoading(false);

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "Não foi possível salvar as alterações.");
      return;
    }

    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <Button type="button" variant="outline" onClick={() => setOpen(true)}>
        Editar cliente
      </Button>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) {
            setError("");
            setWhatsApp(cliente.whatsapp);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar cliente</DialogTitle>
          </DialogHeader>

          <form onSubmit={onSubmit} className="grid gap-2 md:grid-cols-2">
            {error ? <p className="md:col-span-2 text-sm text-red-600">{error}</p> : null}
            <input
              required
              name="nome"
              placeholder="Nome"
              className="rounded-md border p-2"
              defaultValue={defaults.nome}
            />
            <input required name="cpf" placeholder="CPF" className="rounded-md border p-2" defaultValue={defaults.cpf} />
            <input
              required
              name="endereco"
              placeholder="Endereço"
              className="rounded-md border p-2 md:col-span-2"
              defaultValue={defaults.endereco}
            />
            <input
              required
              name="whatsapp"
              placeholder="(67) 99999-9999"
              className="rounded-md border p-2 md:col-span-2"
              value={whatsApp}
              onChange={(e) => setWhatsApp(formatPhone(e.target.value))}
              inputMode="numeric"
              pattern="\(\d{2}\)\s\d{5}-\d{4}"
              title="Use o formato (67) 99999-9999"
            />
            <input
              name="referencia1_nome"
              placeholder="Referência 1 (nome)"
              className="rounded-md border p-2"
              defaultValue={defaults.referencia1_nome}
            />
            <input
              name="referencia1_telefone"
              placeholder="Referência 1 (telefone)"
              className="rounded-md border p-2"
              defaultValue={defaults.referencia1_telefone}
            />
            <input
              name="referencia2_nome"
              placeholder="Referência 2 (nome)"
              className="rounded-md border p-2"
              defaultValue={defaults.referencia2_nome}
            />
            <input
              name="referencia2_telefone"
              placeholder="Referência 2 (telefone)"
              className="rounded-md border p-2"
              defaultValue={defaults.referencia2_telefone}
            />
            <Button type="submit" className="md:col-span-2" disabled={loading}>
              {loading ? "Salvando..." : "Salvar alterações"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
