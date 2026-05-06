import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request, { params }: { params: { type: string } }) {
  const url = new URL(request.url);
  const format = url.searchParams.get("format");

  const rows = await buildRows(params.type);
  if (format === "excel") {
    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet("Relatorio");
    if (rows[0]) ws.columns = Object.keys(rows[0]).map((key) => ({ header: key, key }));
    rows.forEach((row) => ws.addRow(row));
    const buffer = await workbook.xlsx.writeBuffer();
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename=${params.type}.xlsx`
      }
    });
  }

  const doc = new PDFDocument({ margin: 24 });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk) => chunks.push(chunk));
  doc.on("end", () => null);
  doc.fontSize(16).text(`Relatório: ${params.type}`);
  doc.moveDown();
  rows.forEach((row) => doc.fontSize(10).text(JSON.stringify(row)));
  doc.end();
  await new Promise((resolve) => doc.on("end", resolve));

  return new NextResponse(Buffer.concat(chunks), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename=${params.type}.pdf`
    }
  });
}

async function buildRows(type: string) {
  switch (type) {
    case "clientes":
      return prisma.cliente.findMany();
    case "pagamentos":
      return prisma.pagamento.findMany();
    case "parcelas-atrasadas":
      return prisma.parcela.findMany({ where: { status: "vencida" } });
    case "inadimplencia":
      return prisma.parcela.findMany({ where: { status: "vencida" } });
    default:
      return prisma.emprestimo.findMany();
  }
}
