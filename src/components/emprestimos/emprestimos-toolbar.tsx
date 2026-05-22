"use client";

import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";

const NovoEmprestimoModal = dynamic(
  () =>
    import("@/components/emprestimos/novo-emprestimo-modal").then((m) => m.NovoEmprestimoModal),
  {
    ssr: false,
    loading: () => (
      <Button type="button" disabled>
        Novo empréstimo
      </Button>
    )
  }
);

const NovoEmprestimoPersonalizadoModal = dynamic(
  () =>
    import("@/components/emprestimos/novo-emprestimo-personalizado-modal").then(
      (m) => m.NovoEmprestimoPersonalizadoModal
    ),
  {
    ssr: false,
    loading: () => (
      <Button type="button" variant="outline" disabled>
        Empréstimo personalizado
      </Button>
    )
  }
);

export function EmprestimosToolbar() {
  return (
    <div className="flex flex-wrap gap-2">
      <NovoEmprestimoModal />
      <NovoEmprestimoPersonalizadoModal />
    </div>
  );
}
