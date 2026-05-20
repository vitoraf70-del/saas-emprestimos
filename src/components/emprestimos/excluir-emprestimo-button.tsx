"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type ExcluirEmprestimoButtonProps = {
  id: string;
  clienteNome: string;
  valorLabel: string;
};

export function ExcluirEmprestimoButton({ id, clienteNome, valorLabel }: ExcluirEmprestimoButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function confirmar() {
    setLoading(true);
    setError("");
    const response = await fetch(`/api/emprestimos/${id}`, { method: "DELETE" });
    setLoading(false);

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "Não foi possível excluir o empréstimo.");
      return;
    }

    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        title="Excluir empréstimo e todas as parcelas (e pagamentos vinculados)"
        className="border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
        onClick={() => setOpen(true)}
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
            <DialogTitle>Excluir empréstimo</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Cliente: <span className="font-medium text-foreground">{clienteNome}</span>
            <br />
            Valor exibido (referência): <span className="font-medium text-foreground">{valorLabel}</span>
          </p>
          <p className="text-sm text-muted-foreground">
            Serão removidos permanentemente este contrato, todas as parcelas e registros de pagamento PIX associados.
          </p>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button
              type="button"
              className="bg-red-600 text-white hover:bg-red-700"
              onClick={confirmar}
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
