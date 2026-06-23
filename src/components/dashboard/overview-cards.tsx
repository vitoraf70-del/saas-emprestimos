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
    ["Carteira (na rua)", toCurrency(data.totalEmprestado)],
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
    <div className="space-y-3">
      <div>
        <h3 className="text-lg font-semibold tracking-tight">Carteira</h3>
        <p className="text-sm text-muted-foreground">Quanto está emprestado e a receber dos clientes</p>
      </div>
      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-5">
        {items.map(([title, value]) => (
          <Card key={title} className="border-t-2 border-t-primary/60 transition-shadow hover:shadow-md">
            <CardHeader>
              <CardTitle className="text-base">{title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xl font-semibold text-foreground">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
