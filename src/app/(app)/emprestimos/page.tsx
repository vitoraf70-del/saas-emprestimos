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
      <p className="text-sm text-muted-foreground">
        {emprestimos.length} empréstimo(s) cadastrado(s)
      </p>
      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-left">
                <th className="p-3">Cliente</th>
                <th className="p-3">Emprestado</th>
                <th className="p-3">Em aberto</th>
                <th className="p-3">Parcelas</th>
                <th className="p-3">Próx. vencimento</th>
                <th className="p-3">Status</th>
                <th className="p-3 w-[1%] whitespace-nowrap text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {emprestimos.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-muted-foreground">
                    Nenhum empréstimo cadastrado.
                  </td>
                </tr>
              ) : (
                emprestimos.map((e) => {
                  const parcelasOrdenadas = [...e.parcelas].sort(
                    (a, b) => new Date(a.vencimento).getTime() - new Date(b.vencimento).getTime()
                  );
                  const proximaAberta = parcelasOrdenadas.find((p) => p.status !== "paga");
                  const emAberto = parcelasOrdenadas
                    .filter((p) => p.status !== "paga")
                    .reduce((acc, p) => acc + Number(p.valor_atualizado || p.valor_original), 0);
                  const pagas = parcelasOrdenadas.filter((p) => p.status === "paga").length;

                  return (
                    <tr key={e.id} className="border-b">
                      <td className="p-3">{e.cliente.nome}</td>
                      <td className="p-3">{toCurrency(Number(e.valor_emprestado))}</td>
                      <td className="p-3">{toCurrency(emAberto)}</td>
                      <td className="p-3">
                        {pagas}/{e.numero_parcelas} pagas
                      </td>
                      <td className="p-3">
                        {proximaAberta ? formatDateBR(new Date(proximaAberta.vencimento)) : "—"}
                      </td>
                      <td className="p-3">{emprestimoStatusLabel[e.status] ?? e.status}</td>
                      <td className="p-3 text-right">
                        <ExcluirEmprestimoButton
                          id={e.id}
                          clienteNome={e.cliente.nome}
                          valorLabel={toCurrency(Number(e.valor_emprestado))}
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
