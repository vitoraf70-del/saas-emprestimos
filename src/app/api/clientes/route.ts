import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createCliente } from "@/actions/clientes";
import { prisma } from "@/lib/prisma";
import { normalizeBrazilPhone } from "@/lib/utils";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const whatsapp = normalizeBrazilPhone(String(body.whatsapp ?? ""));

    if (!whatsapp) {
      return NextResponse.json(
        { error: "WhatsApp inválido. Use 11 dígitos, ex.: (67) 99999-9999." },
        { status: 400 }
      );
    }

    const cpf = String(body.cpf ?? "").trim();
    const nome = String(body.nome ?? "").trim();
    const endereco = String(body.endereco ?? "").trim();

    if (!nome || !cpf || !endereco) {
      return NextResponse.json({ error: "Preencha nome, CPF e endereço." }, { status: 400 });
    }

    const duplicado = await prisma.cliente.findUnique({ where: { cpf }, select: { id: true } });
    if (duplicado) {
      return NextResponse.json({ error: "Já existe um cliente com esse CPF." }, { status: 409 });
    }

    const cliente = await createCliente({
      nome,
      cpf,
      endereco,
      whatsapp,
      referencia1_nome: String(body.referencia1_nome ?? "").trim() || undefined,
      referencia1_telefone: String(body.referencia1_telefone ?? "").trim() || undefined,
      referencia2_nome: String(body.referencia2_nome ?? "").trim() || undefined,
      referencia2_telefone: String(body.referencia2_telefone ?? "").trim() || undefined
    });

    revalidatePath("/clientes");
    revalidatePath("/emprestimos");
    return NextResponse.json(cliente, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "Já existe um cliente com esse CPF." }, { status: 409 });
    }
    console.error("[POST /api/clientes]", error);
    return NextResponse.json({ error: "Não foi possível salvar o cliente. Tente novamente." }, { status: 500 });
  }
}
