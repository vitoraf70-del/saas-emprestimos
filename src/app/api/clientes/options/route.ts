import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const clientes = await prisma.cliente.findMany({
    select: { id: true, nome: true, cpf: true },
    orderBy: { nome: "asc" }
  });

  return NextResponse.json(clientes);
}
