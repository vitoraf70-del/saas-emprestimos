import { prisma } from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";
import { toCurrency } from "@/lib/utils";
import { diasAtraso, calcularParcelaAtualizada } from "@/lib/finance";
import { NovoEmprestimoModal } from "@/components/emprestimos/novo-emprestimo-modal";
import { formatDateBR } from "@/lib/date";

export default async function EmprestimosPage() {
  const clientes = await prisma.cliente.findMany({
    select: { id: true, nome: true, cpf: true },
    orderBy: { nome: "asc" }
  });

  const parcelasAbertas = await prisma.parcela.findMany({
    where: { status: { in: ["pendente", "vencida"] } },
    include: { emprestimo: true }
  });

  for (const parcela of parcelasAbertas) {
    const atraso = diasAtraso(parcela.vencimento);
    const calc = calcularParcelaAtualizada(Number(parcela.valor_original), atraso);

    const novoStatus = atraso > 0 ? "vencida" : "pendente";
    if (
      parcela.dias_atraso !== calc.diasAtraso ||
      Number(parcela.multa_valor) !== calc.multaValor ||
      Number(parcela.juros_valor) !== calc.jurosValor ||
      Number(parcela.valor_atualizado) !== calc.valorAtualizado ||
      parcela.status !== novoStatus
    ) {
      await prisma.parcela.update({
        where: { id: parcela.id },
        data: {
          dias_atraso: calc.diasAtraso,
          multa_valor: calc.multaValor,
          juros_valor: calc.jurosValor,
          valor_atualizado: calc.valorAtualizado,
          status: novoStatus
        }
      });
    }
  }

  const emprestimos = await prisma.emprestimo.findMany({
    include: { cliente: true, parcelas: true },
    orderBy: { created_at: "desc" }
  });

  const statusLabel = (status: string) => {
    if (status === "paga") return "Pago";
    if (status === "vencida") return "Atrasado";
    return "Pendente";
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-2xl font-bold">Empréstimos</h2>
        <NovoEmprestimoModal clientes={clientes} />
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
                    <td className="p-3">{statusLabel(principal?.status ?? "pendente")}</td>
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
