import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { calcularParcelaComIsencao, diasAtraso } from "@/lib/finance";
import { formatDateBR } from "@/lib/date";
import { toCurrency } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Column = {
  key: string;
  label: string;
  width: number;
  align?: "left" | "right";
};

type ReportData = {
  title: string;
  subtitle?: string;
  columns: Column[];
  rows: Record<string, string | number>[];
  summary?: { label: string; value: string }[];
};

export async function GET(request: Request, { params }: { params: { type: string } }) {
  const url = new URL(request.url);
  const format = url.searchParams.get("format");

  try {
    const report = await buildReport(params.type);

    if (format === "excel") {
      return await exportExcel(report, params.type);
    }
    return exportHtml(report);
  } catch (error) {
    console.error(`[GET /api/reports/${params.type}]`, error);
    return NextResponse.json(
      { error: "Não foi possível gerar o relatório." },
      { status: 500 }
    );
  }
}

async function exportExcel(report: ReportData, type: string) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "PV Soluções";
  workbook.created = new Date();

  const ws = workbook.addWorksheet("Relatório");
  ws.columns = report.columns.map((col) => ({
    header: col.label,
    key: col.key,
    width: Math.max(14, Math.round(col.width / 5))
  }));

  const headerRow = ws.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FF050A18" } };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFD4AF37" }
  };
  headerRow.alignment = { vertical: "middle" };
  headerRow.height = 22;

  report.rows.forEach((row) => ws.addRow(row));

  ws.views = [{ state: "frozen", ySplit: 1 }];
  ws.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: report.columns.length }
  };

  const buffer = await workbook.xlsx.writeBuffer();
  return new NextResponse(buffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="pv-solucoes-${type}.xlsx"`
    }
  });
}

function escapeHtml(value: string | number) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function rowClass(row: Record<string, string | number>) {
  const dias = Number(row["Dias em atraso"]);
  if (!Number.isFinite(dias)) return "";
  if (dias >= 15) return "row-critical";
  if (dias >= 7) return "row-warning";
  return "";
}

function exportHtml(report: ReportData) {
  const gerado = formatDateBR(new Date());
  const hora = new Date().toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Campo_Grande"
  });

  const headerCells = report.columns
    .map(
      (col) =>
        `<th style="text-align:${col.align ?? "left"}">${escapeHtml(col.label)}</th>`
    )
    .join("");

  const bodyRows = report.rows
    .map((row) => {
      const cls = rowClass(row);
      const cells = report.columns
        .map((col) => {
          const raw = row[col.key] ?? "";
          let content = escapeHtml(raw);
          if (col.key === "WhatsApp" && raw) {
            const digits = String(raw).replace(/\D/g, "");
            const full = digits.startsWith("55") ? digits : `55${digits}`;
            content = `<a href="https://wa.me/${full}" target="_blank" rel="noopener">${escapeHtml(raw)}</a>`;
          }
          return `<td style="text-align:${col.align ?? "left"}">${content}</td>`;
        })
        .join("");
      return `<tr class="${cls}">${cells}</tr>`;
    })
    .join("");

  const summaryHtml = (report.summary ?? [])
    .map(
      (s) =>
        `<div class="stat"><span class="stat-label">${escapeHtml(s.label)}</span><strong class="stat-value">${escapeHtml(s.value)}</strong></div>`
    )
    .join("");

  const empty = report.rows.length === 0
    ? `<p class="empty">Nenhum registro encontrado para este relatório.</p>`
    : "";

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(report.title)} — PV Soluções</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: "Segoe UI", system-ui, -apple-system, Roboto, Arial, sans-serif; margin: 0; color: #0a192f; background: #f4f6f9; }
  .page { max-width: 1200px; margin: 0 auto; padding: 28px 24px 40px; }
  .brand { background: linear-gradient(135deg, #050a18 0%, #0a192f 55%, #0f2744 100%); color: #fff; border-radius: 12px; padding: 20px 24px; margin-bottom: 20px; }
  .brand-top { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
  .brand-name { font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; color: #d4af37; font-weight: 700; }
  .brand h1 { margin: 6px 0 0; font-size: 22px; font-weight: 700; }
  .brand p { margin: 6px 0 0; color: #c8d4e8; font-size: 13px; }
  .actions { display: flex; gap: 8px; }
  button { background: linear-gradient(135deg, #d4af37, #b8941f); color: #050a18; border: 0; border-radius: 8px; padding: 10px 16px; font-size: 13px; font-weight: 600; cursor: pointer; }
  button:hover { filter: brightness(1.05); }
  .meta { color: #5c6b82; font-size: 12px; margin-bottom: 16px; }
  .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; margin-bottom: 18px; }
  .stat { background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px 16px; }
  .stat-label { display: block; font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: #64748b; margin-bottom: 4px; }
  .stat-value { font-size: 20px; color: #0a192f; }
  .table-wrap { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th, td { padding: 10px 12px; border-bottom: 1px solid #edf2f7; vertical-align: top; }
  th { background: #0a192f; color: #fff; font-weight: 600; font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em; }
  tr:nth-child(even) td { background: #fafbfc; }
  tr.row-warning td { background: #fffbeb; }
  tr.row-critical td { background: #fef2f2; }
  a { color: #0a192f; font-weight: 600; text-decoration: underline; }
  .empty { color: #64748b; padding: 32px; text-align: center; }
  .footer { margin-top: 18px; font-size: 11px; color: #94a3b8; text-align: center; }
  @media print {
    body { background: #fff; }
    .page { padding: 0; max-width: none; }
    .actions, button { display: none !important; }
    .brand { border-radius: 0; }
    .table-wrap { border: none; border-radius: 0; }
    th { background: #0a192f !important; color: #fff !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    tr.row-warning td, tr.row-critical td { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style>
</head>
<body>
  <div class="page">
    <header class="brand">
      <div class="brand-top">
        <div>
          <div class="brand-name">PV Soluções</div>
          <h1>${escapeHtml(report.title)}</h1>
          ${report.subtitle ? `<p>${escapeHtml(report.subtitle)}</p>` : ""}
        </div>
        <div class="actions">
          <button type="button" onclick="window.print()">Imprimir / Salvar PDF</button>
        </div>
      </div>
    </header>
    <div class="meta">Gerado em ${gerado} às ${hora} (Campo Grande) · ${report.rows.length} registro(s)</div>
    ${summaryHtml ? `<div class="summary">${summaryHtml}</div>` : ""}
    <div class="table-wrap">
      <table>
        <thead><tr>${headerCells}</tr></thead>
        <tbody>${bodyRows}</tbody>
      </table>
      ${empty}
    </div>
    <div class="footer">PV Soluções · crediarioms.com · Relatório confidencial para uso interno</div>
  </div>
</body>
</html>`;

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" }
  });
}

async function buildReport(type: string): Promise<ReportData> {
  switch (type) {
    case "inadimplencia":
      return buildInadimplencia();
    case "parcelas-atrasadas":
      return buildParcelasAtrasadas();
    case "pagamentos":
      return buildPagamentos();
    case "clientes":
      return buildClientes();
    case "lucro-mensal":
      return buildLucroMensal();
    default:
      return buildInadimplencia();
  }
}

async function buildInadimplencia(): Promise<ReportData> {
  const parcelas = await prisma.parcela.findMany({
    where: { status: { in: ["vencida", "pendente"] } },
    select: {
      valor_original: true,
      vencimento: true,
      encargos_isentos: true,
      juros_isentos: true,
      emprestimo: {
        select: {
          frequencia_parcela: true,
          cliente: {
            select: { id: true, nome: true, endereco: true, whatsapp: true }
          }
        }
      }
    }
  });

  type Agg = {
    nome: string;
    endereco: string;
    whatsapp: string;
    parcelasVencidas: number;
    diasAtrasoMax: number;
    totalDevido: number;
  };

  const porCliente = new Map<string, Agg>();

  for (const parcela of parcelas) {
    const dias = diasAtraso(parcela.vencimento);
    if (dias <= 0) continue; // só quem realmente está em atraso

    const calc = calcularParcelaComIsencao(
      Number(parcela.valor_original),
      dias,
      parcela.emprestimo.frequencia_parcela,
      parcela.encargos_isentos,
      parcela.juros_isentos
    );

    const cliente = parcela.emprestimo.cliente;
    const atual = porCliente.get(cliente.id) ?? {
      nome: cliente.nome,
      endereco: cliente.endereco,
      whatsapp: cliente.whatsapp,
      parcelasVencidas: 0,
      diasAtrasoMax: 0,
      totalDevido: 0
    };
    atual.parcelasVencidas += 1;
    atual.diasAtrasoMax = Math.max(atual.diasAtrasoMax, dias);
    atual.totalDevido += calc.valorAtualizado;
    porCliente.set(cliente.id, atual);
  }

  const rows = [...porCliente.values()]
    .sort((a, b) => b.diasAtrasoMax - a.diasAtrasoMax)
    .map((c) => ({
      Cliente: c.nome,
      Endereco: c.endereco,
      WhatsApp: c.whatsapp,
      "Parc. vencidas": c.parcelasVencidas,
      "Dias em atraso": c.diasAtrasoMax,
      "Total devido": toCurrency(c.totalDevido)
    }));

  const totalGeral = [...porCliente.values()].reduce((acc, c) => acc + c.totalDevido, 0);
  const parcelasTotal = [...porCliente.values()].reduce((acc, c) => acc + c.parcelasVencidas, 0);

  return {
    title: "Inadimplência",
    subtitle: "Clientes em atraso — dados para cobrança presencial",
    summary: [
      { label: "Clientes em atraso", value: String(rows.length) },
      { label: "Parcelas vencidas", value: String(parcelasTotal) },
      { label: "Total a receber", value: toCurrency(totalGeral) }
    ],
    columns: [
      { key: "Cliente", label: "Cliente", width: 150 },
      { key: "Endereco", label: "Endereço", width: 250 },
      { key: "WhatsApp", label: "WhatsApp", width: 100 },
      { key: "Parc. vencidas", label: "Parc. vencidas", width: 75, align: "right" },
      { key: "Dias em atraso", label: "Dias atraso", width: 75, align: "right" },
      { key: "Total devido", label: "Total devido", width: 90, align: "right" }
    ],
    rows
  };
}

async function buildParcelasAtrasadas(): Promise<ReportData> {
  const parcelas = await prisma.parcela.findMany({
    where: { status: { in: ["vencida", "pendente"] } },
    select: {
      numero_parcela: true,
      valor_original: true,
      vencimento: true,
      encargos_isentos: true,
      juros_isentos: true,
      emprestimo: {
        select: {
          frequencia_parcela: true,
          cliente: { select: { id: true, nome: true, endereco: true, whatsapp: true } }
        }
      }
    },
    orderBy: { vencimento: "asc" }
  });

  type Agg = {
    nome: string;
    endereco: string;
    whatsapp: string;
    numeros: number[];
    diasAtrasoMax: number;
    primeiroVencimento: Date;
    totalDevido: number;
  };

  const porCliente = new Map<string, Agg>();

  for (const p of parcelas) {
    const dias = diasAtraso(p.vencimento);
    if (dias <= 0) continue;

    const calc = calcularParcelaComIsencao(
      Number(p.valor_original),
      dias,
      p.emprestimo.frequencia_parcela,
      p.encargos_isentos,
      p.juros_isentos
    );

    const cliente = p.emprestimo.cliente;
    const atual = porCliente.get(cliente.id) ?? {
      nome: cliente.nome,
      endereco: cliente.endereco,
      whatsapp: cliente.whatsapp,
      numeros: [],
      diasAtrasoMax: 0,
      primeiroVencimento: p.vencimento,
      totalDevido: 0
    };
    atual.numeros.push(p.numero_parcela);
    atual.diasAtrasoMax = Math.max(atual.diasAtrasoMax, dias);
    if (p.vencimento < atual.primeiroVencimento) atual.primeiroVencimento = p.vencimento;
    atual.totalDevido += calc.valorAtualizado;
    porCliente.set(cliente.id, atual);
  }

  const rows = [...porCliente.values()]
    .sort((a, b) => b.diasAtrasoMax - a.diasAtrasoMax)
    .map((c) => {
      const ordenados = [...c.numeros].sort((a, b) => a - b);
      const listaNumeros = ordenados.join(", ");
      return {
        Cliente: c.nome,
        Endereco: c.endereco,
        WhatsApp: c.whatsapp,
        "Parcelas em atraso":
          ordenados.length === 1
            ? `1 (nº ${listaNumeros})`
            : `${ordenados.length} (nº ${listaNumeros})`,
        "1º vencimento": formatDateBR(c.primeiroVencimento),
        "Dias em atraso": c.diasAtrasoMax,
        "Total devido": toCurrency(c.totalDevido)
      };
    });

  const totalGeral = [...porCliente.values()].reduce((acc, c) => acc + c.totalDevido, 0);
  const parcelasTotal = [...porCliente.values()].reduce((acc, c) => acc + c.numeros.length, 0);

  return {
    title: "Parcelas atrasadas",
    subtitle: "Agrupado por cliente — quantidade e números das parcelas em atraso",
    summary: [
      { label: "Clientes em atraso", value: String(rows.length) },
      { label: "Parcelas vencidas", value: String(parcelasTotal) },
      { label: "Total a receber", value: toCurrency(totalGeral) }
    ],
    columns: [
      { key: "Cliente", label: "Cliente", width: 140 },
      { key: "Endereco", label: "Endereço", width: 190 },
      { key: "WhatsApp", label: "WhatsApp", width: 95 },
      { key: "Parcelas em atraso", label: "Parcelas em atraso", width: 120 },
      { key: "1º vencimento", label: "1º vencimento", width: 80 },
      { key: "Dias em atraso", label: "Dias", width: 45, align: "right" },
      { key: "Total devido", label: "Total devido", width: 85, align: "right" }
    ],
    rows
  };
}

async function buildPagamentos(): Promise<ReportData> {
  const pagamentos = await prisma.pagamento.findMany({
    where: { status: "confirmado" },
    orderBy: { data_pagamento: "desc" },
    select: {
      valor_pago: true,
      metodo: true,
      data_pagamento: true,
      parcela: {
        select: {
          numero_parcela: true,
          emprestimo: { select: { cliente: { select: { nome: true } } } }
        }
      }
    }
  });

  const rows = pagamentos.map((p) => ({
    Cliente: p.parcela.emprestimo.cliente.nome,
    Parcela: p.parcela.numero_parcela,
    Metodo: p.metodo,
    Data: formatDateBR(p.data_pagamento),
    Valor: toCurrency(Number(p.valor_pago))
  }));

  return {
    title: "Pagamentos recebidos",
    columns: [
      { key: "Cliente", label: "Cliente", width: 220 },
      { key: "Parcela", label: "Parcela", width: 70, align: "right" },
      { key: "Metodo", label: "Método", width: 90 },
      { key: "Data", label: "Data", width: 100 },
      { key: "Valor", label: "Valor", width: 100, align: "right" }
    ],
    rows
  };
}

async function buildClientes(): Promise<ReportData> {
  const clientes = await prisma.cliente.findMany({ orderBy: { nome: "asc" } });
  const rows = clientes.map((c) => ({
    Nome: c.nome,
    CPF: c.cpf,
    WhatsApp: c.whatsapp,
    Endereco: c.endereco
  }));

  return {
    title: "Clientes",
    columns: [
      { key: "Nome", label: "Nome", width: 180 },
      { key: "CPF", label: "CPF", width: 120 },
      { key: "WhatsApp", label: "WhatsApp", width: 110 },
      { key: "Endereco", label: "Endereço", width: 360 }
    ],
    rows
  };
}

async function buildLucroMensal(): Promise<ReportData> {
  const pagamentos = await prisma.pagamento.findMany({
    where: { status: "confirmado" },
    select: { valor_pago: true, data_pagamento: true }
  });

  const porMes = new Map<string, number>();
  for (const p of pagamentos) {
    const mes = p.data_pagamento.toISOString().slice(0, 7);
    porMes.set(mes, (porMes.get(mes) ?? 0) + Number(p.valor_pago));
  }

  const rows = [...porMes.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([mes, total]) => ({
      Mes: mes,
      "Total recebido": toCurrency(total)
    }));

  return {
    title: "Recebimentos por mês",
    columns: [
      { key: "Mes", label: "Mês", width: 120 },
      { key: "Total recebido", label: "Total recebido", width: 150, align: "right" }
    ],
    rows
  };
}
