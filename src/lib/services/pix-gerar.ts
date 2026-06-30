import { prisma } from "@/lib/prisma";
import { buildPixTxidFromSeed } from "@/lib/services/pixTxid";
import { createPixCharge, type PixCharge } from "@/lib/services/pix";

export type GerarPixInput = {
  seed: string;
  parcelaId: string;
  amount: number;
  description: string;
  payerName: string;
  payerCpf: string;
};

const PROVIDERS_COM_TXID_LOCAL = new Set(["inter", "c6"]);

/** Gera cobrança PIX e garante registro em Pagamento antes de chamar o banco (Inter/C6). */
export async function gerarPixComRegistro(input: GerarPixInput): Promise<PixCharge> {
  const provider = (process.env.PIX_PROVIDER ?? "mercado_pago").toLowerCase();

  if (PROVIDERS_COM_TXID_LOCAL.has(provider)) {
    const txid = buildPixTxidFromSeed(input.seed);
    const existente = await prisma.pagamento.findUnique({ where: { transaction_id: txid } });

    if (existente?.status === "confirmado") {
      throw new Error("Esta cobrança PIX já foi paga.");
    }

    if (!existente) {
      await prisma.pagamento.create({
        data: {
          parcela_id: input.parcelaId,
          valor_pago: input.amount,
          metodo: "pix",
          transaction_id: txid,
          status: "pendente"
        }
      });
    }

    try {
      return await createPixCharge({
        transactionId: input.seed,
        amount: input.amount,
        description: input.description,
        payerName: input.payerName,
        payerCpf: input.payerCpf
      });
    } catch (error) {
      await prisma.pagamento.deleteMany({ where: { transaction_id: txid, status: "pendente" } });
      throw error;
    }
  }

  const pix = await createPixCharge({
    transactionId: input.seed,
    amount: input.amount,
    description: input.description,
    payerName: input.payerName,
    payerCpf: input.payerCpf
  });

  await prisma.pagamento.create({
    data: {
      parcela_id: input.parcelaId,
      valor_pago: input.amount,
      metodo: "pix",
      transaction_id: pix.transactionId,
      status: "pendente"
    }
  });

  return pix;
}
