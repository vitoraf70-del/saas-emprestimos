import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { updateCliente } from "@/actions/clientes";

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const body = await request.json();
  const phonePattern = /^\(\d{2}\)\s\d{5}-\d{4}$/;

  if (!phonePattern.test(String(body.whatsapp ?? ""))) {
    return NextResponse.json(
      { error: "WhatsApp inválido. Use o formato (67) 99999-9999." },
      { status: 400 }
    );
  }

  const clienteAtual = await prisma.cliente.findUnique({ where: { id: params.id }, select: { cpf: true } });
  if (!clienteAtual) {
    return NextResponse.json({ error: "Cliente não encontrado." }, { status: 404 });
  }

  const cpf = String(body.cpf ?? "");
  if (cpf !== clienteAtual.cpf) {
    const duplicado = await prisma.cliente.findUnique({ where: { cpf }, select: { id: true } });
    if (duplicado) {
      return NextResponse.json({ error: "Já existe um cliente com esse CPF." }, { status: 409 });
    }
  }

  const cliente = await updateCliente(params.id, {
    nome: String(body.nome ?? ""),
    cpf,
    endereco: String(body.endereco ?? ""),
    whatsapp: String(body.whatsapp ?? ""),
    referencia1_nome:
      "referencia1_nome" in body ? (String(body.referencia1_nome ?? "").trim() || null) : undefined,
    referencia1_telefone:
      "referencia1_telefone" in body ? (String(body.referencia1_telefone ?? "").trim() || null) : undefined,
    referencia2_nome:
      "referencia2_nome" in body ? (String(body.referencia2_nome ?? "").trim() || null) : undefined,
    referencia2_telefone:
      "referencia2_telefone" in body ? (String(body.referencia2_telefone ?? "").trim() || null) : undefined
  });

  return NextResponse.json(cliente);
}
