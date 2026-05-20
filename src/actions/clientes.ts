"use server";

import { prisma } from "@/lib/prisma";

type CreateClienteInput = {
  nome: string;
  cpf: string;
  endereco: string;
  whatsapp: string;
  referencia1_nome?: string;
  referencia1_telefone?: string;
  referencia2_nome?: string;
  referencia2_telefone?: string;
};

type UpdateClienteInput = Omit<CreateClienteInput, "referencia1_nome" | "referencia1_telefone" | "referencia2_nome" | "referencia2_telefone"> & {
  referencia1_nome?: string | null;
  referencia1_telefone?: string | null;
  referencia2_nome?: string | null;
  referencia2_telefone?: string | null;
};

export async function createCliente(input: CreateClienteInput) {
  return prisma.cliente.create({ data: input });
}

export async function updateCliente(id: string, input: UpdateClienteInput) {
  return prisma.cliente.update({
    where: { id },
    data: input
  });
}

export async function deleteCliente(id: string) {
  const emprestimos = await prisma.emprestimo.count({ where: { cliente_id: id } });
  if (emprestimos > 0) {
    throw new Error(
      "Não é possível excluir: este cliente possui empréstimos cadastrados. Remova os empréstimos antes."
    );
  }
  await prisma.cliente.delete({ where: { id } });
}
