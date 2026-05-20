"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type ExcluirClienteButtonProps = {
  id: string;
  nome: string;
  emprestimosCount: number;
  /** Se definido, navega após exclusão (ex.: "/clientes" na página de detalhe). */
  aposExcluirHref?: string;
  size?: "default" | "sm" | "icon";
};

export function ExcluirClienteButton({
  id,
  nome,
  emprestimosCount,
  aposExcluirHref,
  size = "sm"
}: ExcluirClienteButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const bloqueado = emprestimosCount > 0;

  async function confirmarExclusao() {
    setLoading(true);
    setError("");
    const response = await fetch(`/api/clientes/${id}`, { method: "DELETE" });
    setLoading(false);

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "Não foi possível excluir o cliente.");
      return;
    }

    setOpen(false);
    if (aposExcluirHref) {
      router.push(aposExcluirHref);
    } else {
      router.refresh();
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size={size}
        disabled={bloqueado}
        title={
          bloqueado
            ? "Exclusão bloqueada: há empréstimos vinculados a este cliente."
            : "Excluir cliente"
        }
        className={
          bloqueado
            ? "text-muted-foreground"
            : "border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
        }
        onClick={() => {
          if (!bloqueado) setOpen(true);
        }}
      >
        Excluir
      </Button>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setError("");
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir cliente</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Tem certeza que deseja excluir <span className="font-medium text-foreground">{nome}</span>? Esta ação não
            pode ser desfeita.
          </p>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button
              type="button"
              className="bg-red-600 text-white hover:bg-red-700"
              onClick={confirmarExclusao}
              disabled={loading}
            >
              {loading ? "Excluindo..." : "Excluir definitivamente"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
