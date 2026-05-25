import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { deleteCliente, updateCliente } from "@/actions/clientes";
import { normalizeBrazilPhone } from "@/lib/utils";

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const body = await request.json();
  const whatsapp = normalizeBrazilPhone(String(body.whatsapp ?? ""));

  if (!whatsapp) {
    return NextResponse.json(
      { error: "WhatsApp inválido. Use 11 dígitos, ex.: (67) 99999-9999." },
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
    whatsapp,
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

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const exists = await prisma.cliente.findUnique({ where: { id: params.id }, select: { id: true } });
  if (!exists) {
    return NextResponse.json({ error: "Cliente não encontrado." }, { status: 404 });
  }

  try {
    await deleteCliente(params.id);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível excluir o cliente.";
    const status = message.includes("empréstimos") ? 409 : 400;
    return NextResponse.json({ error: message }, { status });
  }

  return NextResponse.json({ ok: true });
}
