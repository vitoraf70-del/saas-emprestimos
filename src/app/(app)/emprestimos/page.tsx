import { recalculateOpenParcelas } from "@/actions/parcelas";
import { prisma } from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";
import { toCurrency } from "@/lib/utils";
import { NovoEmprestimoModal } from "@/components/emprestimos/novo-emprestimo-modal";
import { NovoEmprestimoPersonalizadoModal } from "@/components/emprestimos/novo-emprestimo-personalizado-modal";
import { ExcluirEmprestimoButton } from "@/components/emprestimos/excluir-emprestimo-button";
import { formatDateBR } from "@/lib/date";

const emprestimoStatusLabel: Record<string, string> = {
  ativo: "Ativo",
  quitado: "Quitado",
  inadimplente: "Inadimplente"
};

export default async function EmprestimosPage() {
  await recalculateOpenParcelas();

  const clientes = await prisma.cliente.findMany({
    select: { id: true, nome: true, cpf: true },
    orderBy: { nome: "asc" }
  });

  const emprestimos = await prisma.emprestimo.findMany({
    include: { cliente: true, parcelas: true },
    orderBy: { created_at: "desc" }
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-2xl font-bold">Empréstimos</h2>
        <div className="flex flex-wrap gap-2">
          <NovoEmprestimoModal clientes={clientes} />
          <NovoEmprestimoPersonalizadoModal clientes={clientes} />
        </div>
      </div>
      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-left">
                <th className="p-3">Cliente</th>
                <th className="p-3">Valor</th>
                <th className="p-3">Vencimento</th>
                <th className="p-3">Status</th>
                <th className="p-3 w-[1%] whitespace-nowrap text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {emprestimos.map((e) => {
                const principal = e.parcelas.sort(
                  (a, b) => new Date(a.vencimento).getTime() - new Date(b.vencimento).getTime()
                )[0];
                return (
                  <tr key={e.id} className="border-b">
                    <td className="p-3">{e.cliente.nome}</td>
                    <td className="p-3">{toCurrency(Number(principal?.valor_atualizado ?? e.valor_emprestado))}</td>
                    <td className="p-3">
                      {principal ? formatDateBR(new Date(principal.vencimento)) : "-"}
                    </td>
                    <td className="p-3">{emprestimoStatusLabel[e.status] ?? e.status}</td>
                    <td className="p-3 text-right">
                      <ExcluirEmprestimoButton
                        id={e.id}
                        clienteNome={e.cliente.nome}
                        valorLabel={toCurrency(Number(principal?.valor_atualizado ?? e.valor_emprestado))}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
