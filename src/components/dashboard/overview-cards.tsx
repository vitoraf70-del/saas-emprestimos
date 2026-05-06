import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toCurrency } from "@/lib/utils";

type Props = {
  data: {
    totalEmprestado: number;
    totalRecebido: number;
    totalAReceber: number;
    lucroTotal: number;
    lucroPercentual: number;
    inadimplenciaPercentual: number;
    parcelasVencidas: number;
    valorEmAtraso: number;
    clientesAtivos: number;
  };
};

export function OverviewCards({ data }: Props) {
  const items = [
    ["Total emprestado", toCurrency(data.totalEmprestado)],
    ["Total recebido", toCurrency(data.totalRecebido)],
    ["Total a receber", toCurrency(data.totalAReceber)],
    ["Lucro total", toCurrency(data.lucroTotal)],
    ["Lucro %", `${data.lucroPercentual.toFixed(2)}%`],
    ["Inadimplência %", `${data.inadimplenciaPercentual.toFixed(2)}%`],
    ["Parcelas vencidas", String(data.parcelasVencidas)],
    ["Valor em atraso", toCurrency(data.valorEmAtraso)],
    ["Clientes ativos", String(data.clientesAtivos)]
  ];

  return (
    <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-5">
      {items.map(([title, value]) => (
        <Card key={title}>
          <CardHeader>
            <CardTitle>{title}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-semibold">{value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
