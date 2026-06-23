import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toCurrency } from "@/lib/utils";

type Props = {
  data: {
    liberadoNovos: number;
    liberadoRenovacoes: number;
    recebido: number;
    saldoAtual: number;
  };
};

export function CaixaCards({ data }: Props) {
  const items = [
    ["Liberado em novos empréstimos", toCurrency(data.liberadoNovos)],
    ["Liberado em renovações", toCurrency(data.liberadoRenovacoes)],
    ["Recebido dos clientes", toCurrency(data.recebido)],
    ["Saldo atual de caixa", toCurrency(data.saldoAtual)]
  ];

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-lg font-semibold tracking-tight">Gestão de Caixa</h3>
        <p className="text-sm text-muted-foreground">
          Dinheiro que realmente entrou e saiu do seu bolso (mesmos recebimentos da Carteira)
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {items.map(([title, value]) => (
          <Card key={title} className="border-t-2 border-t-emerald-500/70 transition-shadow hover:shadow-md">
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
