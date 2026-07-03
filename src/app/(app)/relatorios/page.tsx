import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileSpreadsheet, FileText, Printer } from "lucide-react";

type ReportItem = {
  id: string;
  title: string;
  description: string;
  featured?: boolean;
};

const reports: ReportItem[] = [
  {
    id: "inadimplencia",
    title: "Inadimplência",
    description:
      "Lista de clientes em atraso com endereço, WhatsApp, dias de atraso e total devido. Ideal para enviar ao cobrador.",
    featured: true
  },
  {
    id: "parcelas-atrasadas",
    title: "Parcelas atrasadas",
    description: "Detalhamento parcela a parcela, com vencimento e valor atualizado."
  },
  {
    id: "pagamentos",
    title: "Pagamentos",
    description: "Histórico de recebimentos confirmados por PIX."
  },
  {
    id: "lucro-mensal",
    title: "Recebimentos mensais",
    description: "Total recebido agrupado por mês."
  },
  {
    id: "clientes",
    title: "Clientes",
    description: "Cadastro completo com CPF, telefone e endereço."
  }
];

export default function RelatoriosPage() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold tracking-tight">Relatórios</h2>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Exporte listas para cobrança presencial, controle financeiro e arquivo. Os relatórios
          usam dados em tempo real do sistema.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {reports.map((report) => (
          <Card
            key={report.id}
            className={
              report.featured
                ? "border-primary/30 bg-gradient-to-br from-card to-accent/30 shadow-sm"
                : "shadow-sm"
            }
          >
            <CardHeader className="pb-3">
              <div className="flex items-start gap-3">
                <div
                  className={
                    report.featured
                      ? "rounded-lg bg-primary/15 p-2.5 text-primary"
                      : "rounded-lg bg-muted p-2.5 text-muted-foreground"
                  }
                >
                  <FileText className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <CardTitle className="text-lg">{report.title}</CardTitle>
                  {report.featured ? (
                    <span className="inline-block rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary">
                      Recomendado para cobrador
                    </span>
                  ) : null}
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {report.description}
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Button asChild variant="outline" className="gap-2">
                <a
                  href={`/api/reports/${report.id}?format=view`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Printer className="h-4 w-4" />
                  Abrir / Imprimir
                </a>
              </Button>
              <Button asChild className="btn-gold gap-2">
                <a href={`/api/reports/${report.id}?format=excel`}>
                  <FileSpreadsheet className="h-4 w-4" />
                  Exportar Excel
                </a>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
