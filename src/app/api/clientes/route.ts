import { NextResponse } from "next/server";
import { createCliente } from "@/actions/clientes";

export async function POST(request: Request) {
  const body = await request.json();
  const phonePattern = /^\(\d{2}\)\s\d{5}-\d{4}$/;

  if (!phonePattern.test(String(body.whatsapp ?? ""))) {
    return NextResponse.json(
      { error: "WhatsApp inválido. Use o formato (67) 99999-9999." },
      { status: 400 }
    );
  }

  const cliente = await createCliente({
    nome: body.nome,
    cpf: body.cpf,
    endereco: body.endereco,
    whatsapp: body.whatsapp,
    referencia1_nome: body.referencia1_nome || undefined,
    referencia1_telefone: body.referencia1_telefone || undefined,
    referencia2_nome: body.referencia2_nome || undefined,
    referencia2_telefone: body.referencia2_telefone || undefined
  });

  return NextResponse.json(cliente, { status: 201 });
}
