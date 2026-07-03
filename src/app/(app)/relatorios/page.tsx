import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const reports = [
  "lucro-mensal",
  "inadimplencia",
  "pagamentos",
  "parcelas-atrasadas",
  "clientes"
];

export default function RelatoriosPage() {
  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Relatórios</h2>
      <div className="grid gap-4 md:grid-cols-2">
        {reports.map((name) => (
          <Card key={name}>
            <CardHeader>
              <CardTitle className="capitalize">{name.replace("-", " ")}</CardTitle>
            </CardHeader>
            <CardContent className="flex gap-2">
              <Button asChild variant="outline"><a href={`/api/reports/${name}?format=view`} target="_blank" rel="noopener noreferrer">Abrir / Imprimir</a></Button>
              <Button asChild><a href={`/api/reports/${name}?format=excel`}>Exportar Excel</a></Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
