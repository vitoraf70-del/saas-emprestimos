import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const clientes = await prisma.cliente.findMany({
    select: { id: true, nome: true, cpf: true },
    orderBy: { nome: "asc" }
  });

  return NextResponse.json(clientes);
}
