import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
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
  columns: Column[];
  rows: Record<string, string | number>[];
};

export async function GET(request: Request, { params }: { params: { type: string } }) {
  const url = new URL(request.url);
  const format = url.searchParams.get("format");

  try {
    const report = await buildReport(params.type);

    if (format === "excel") {
      return await exportExcel(report, params.type);
    }
    return await exportPdf(report, params.type);
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
  const ws = workbook.addWorksheet("Relatorio");
  ws.columns = report.columns.map((col) => ({
    header: col.label,
    key: col.key,
    width: Math.max(12, Math.round(col.width / 6))
  }));
  ws.getRow(1).font = { bold: true };
  report.rows.forEach((row) => ws.addRow(row));

  const buffer = await workbook.xlsx.writeBuffer();
  return new NextResponse(buffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename=${type}.xlsx`
    }
  });
}

async function exportPdf(report: ReportData, type: string) {
  const doc = new PDFDocument({ margin: 28, size: "A4", layout: "landscape" });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk) => chunks.push(chunk));
  const done = new Promise<void>((resolve) => doc.on("end", () => resolve()));

  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;

  doc.fontSize(16).font("Helvetica-Bold").text(report.title);
  doc
    .fontSize(9)
    .font("Helvetica")
    .fillColor("#666")
    .text(`Gerado em ${formatDateBR(new Date())} — ${report.rows.length} registro(s)`);
  doc.fillColor("#000").moveDown(0.5);

  const drawHeader = () => {
    let x = left;
    doc.fontSize(9).font("Helvetica-Bold");
    for (const col of report.columns) {
      doc.text(col.label, x, doc.y, {
        width: col.width,
        align: col.align ?? "left",
        continued: false,
        lineBreak: false
      });
      x += col.width;
    }
    doc.moveDown(0.3);
    doc
      .moveTo(left, doc.y)
      .lineTo(right, doc.y)
      .strokeColor("#ccc")
      .stroke();
    doc.moveDown(0.2);
  };

  drawHeader();
  doc.font("Helvetica").fontSize(9);

  for (const row of report.rows) {
    const rowHeights = report.columns.map((col) =>
      doc.heightOfString(String(row[col.key] ?? ""), { width: col.width })
    );
    const rowHeight = Math.max(...rowHeights, 12);

    if (doc.y + rowHeight > doc.page.height - doc.page.margins.bottom) {
      doc.addPage();
      drawHeader();
      doc.font("Helvetica").fontSize(9);
    }

    const y = doc.y;
    let x = left;
    for (const col of report.columns) {
      doc.text(String(row[col.key] ?? ""), x, y, {
        width: col.width,
        align: col.align ?? "left"
      });
      x += col.width;
    }
    doc.y = y + rowHeight + 4;
  }

  if (report.rows.length === 0) {
    doc.moveDown().fontSize(11).text("Nenhum registro encontrado.");
  }

  doc.end();
  await done;

  return new NextResponse(Buffer.concat(chunks), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename=${type}.pdf`
    }
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

  return {
    title: "Inadimplência — clientes em atraso",
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
          cliente: { select: { nome: true, endereco: true, whatsapp: true } }
        }
      }
    },
    orderBy: { vencimento: "asc" }
  });

  const rows = parcelas
    .map((p) => {
      const dias = diasAtraso(p.vencimento);
      if (dias <= 0) return null;
      const calc = calcularParcelaComIsencao(
        Number(p.valor_original),
        dias,
        p.emprestimo.frequencia_parcela,
        p.encargos_isentos,
        p.juros_isentos
      );
      return {
        dias,
        row: {
          Cliente: p.emprestimo.cliente.nome,
          Endereco: p.emprestimo.cliente.endereco,
          WhatsApp: p.emprestimo.cliente.whatsapp,
          Parcela: p.numero_parcela,
          Vencimento: formatDateBR(p.vencimento),
          "Dias em atraso": dias,
          "Valor atualizado": toCurrency(calc.valorAtualizado)
        }
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .sort((a, b) => b.dias - a.dias)
    .map((r) => r.row);

  return {
    title: "Parcelas atrasadas",
    columns: [
      { key: "Cliente", label: "Cliente", width: 140 },
      { key: "Endereco", label: "Endereço", width: 200 },
      { key: "WhatsApp", label: "WhatsApp", width: 95 },
      { key: "Parcela", label: "Parc.", width: 45, align: "right" },
      { key: "Vencimento", label: "Vencimento", width: 75 },
      { key: "Dias em atraso", label: "Dias", width: 45, align: "right" },
      { key: "Valor atualizado", label: "Valor", width: 85, align: "right" }
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
