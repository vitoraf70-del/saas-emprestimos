type CreatePixChargeInput = {
  transactionId: string;
  amount: number;
  description: string;
  payerName: string;
  payerCpf: string;
};

export type PixCharge = {
  transactionId: string;
  copyPasteCode: string;
  qrCodeBase64?: string;
  paymentLink?: string;
};

function isInterPixConfigured() {
  const hasBase = ["INTER_CLIENT_ID", "INTER_CLIENT_SECRET", "INTER_PIX_KEY"].every((key) =>
    Boolean(process.env[key]?.trim())
  );
  const hasCert = Boolean(process.env.INTER_MTLS_CERT?.trim() || process.env.INTER_MTLS_CERT_PATH?.trim());
  const hasKey = Boolean(process.env.INTER_MTLS_KEY?.trim() || process.env.INTER_MTLS_KEY_PATH?.trim());
  return hasBase && hasCert && hasKey;
}

function isC6PixConfigured() {
  const required = ["C6_CLIENT_ID", "C6_CLIENT_SECRET", "C6_PIX_KEY", "C6_MTLS_CERT", "C6_MTLS_KEY"];
  return required.every((key) => Boolean(process.env[key]?.trim()));
}

export function isPixConfigured() {
  const provider = process.env.PIX_PROVIDER ?? "mercado_pago";
  if (provider === "asaas") return Boolean(process.env.ASAAS_API_KEY);
  if (provider === "inter") return isInterPixConfigured();
  if (provider === "c6") return isC6PixConfigured();
  return Boolean(process.env.MERCADO_PAGO_ACCESS_TOKEN);
}

export async function createPixCharge(input: CreatePixChargeInput): Promise<PixCharge> {
  const provider = process.env.PIX_PROVIDER ?? "mercado_pago";
  if (provider === "asaas") return createAsaasCharge(input);
  if (provider === "inter") return createInterCharge(input);
  if (provider === "c6") return createC6Charge(input);
  return createMercadoPagoCharge(input);
}

async function createMercadoPagoCharge(input: CreatePixChargeInput): Promise<PixCharge> {
  const token = process.env.MERCADO_PAGO_ACCESS_TOKEN;
  if (!token) throw new Error("Mercado Pago não configurado");

  const response = await fetch("https://api.mercadopago.com/v1/payments", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-Idempotency-Key": input.transactionId
    },
    body: JSON.stringify({
      transaction_amount: input.amount,
      description: input.description,
      payment_method_id: "pix",
      payer: {
        email: "pagador@exemplo.com",
        first_name: input.payerName,
        identification: { type: "CPF", number: input.payerCpf }
      }
    })
  });
  if (!response.ok) throw new Error("Falha ao gerar PIX no Mercado Pago");
  const data = await response.json();
  return {
    transactionId: String(data.id),
    copyPasteCode: data.point_of_interaction.transaction_data.qr_code,
    qrCodeBase64: data.point_of_interaction.transaction_data.qr_code_base64
  };
}

async function createAsaasCharge(input: CreatePixChargeInput): Promise<PixCharge> {
  const key = process.env.ASAAS_API_KEY;
  if (!key) throw new Error("Asaas não configurado");

  const paymentResp = await fetch("https://api.asaas.com/v3/payments", {
    method: "POST",
    headers: {
      access_token: key,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      billingType: "PIX",
      value: input.amount,
      dueDate: new Date().toISOString().slice(0, 10),
      description: input.description
    })
  });
  if (!paymentResp.ok) throw new Error("Falha ao criar cobrança Asaas");
  const payment = await paymentResp.json();

  const pixResp = await fetch(`https://api.asaas.com/v3/payments/${payment.id}/pixQrCode`, {
    headers: { access_token: key }
  });
  if (!pixResp.ok) throw new Error("Falha ao buscar QRCode Asaas");
  const pix = await pixResp.json();

  return {
    transactionId: payment.id,
    copyPasteCode: pix.payload,
    qrCodeBase64: pix.encodedImage,
    paymentLink: payment.invoiceUrl
  };
}

async function createInterCharge(input: CreatePixChargeInput): Promise<PixCharge> {
  const { buildInterTxidFromSeed, interCreateCobrancaImediata } = await import("./interPix");

  if (!isInterPixConfigured()) {
    throw new Error("Inter PIX não configurado (credenciais/certificados)");
  }

  const txid = buildInterTxidFromSeed(input.transactionId);
  const cpfDigits = input.payerCpf.replace(/\D/g, "").slice(0, 11);

  const cob = await interCreateCobrancaImediata({
    txid,
    amount: input.amount,
    solicitacaoPagador: input.description,
    expiracaoSegundos: process.env.INTER_PIX_EXPIRACAO_SEGUNDOS
      ? Number(process.env.INTER_PIX_EXPIRACAO_SEGUNDOS)
      : undefined,
    devedor:
      cpfDigits.length === 11
        ? {
            cpf: cpfDigits,
            nome: input.payerName.slice(0, 80)
          }
        : undefined
  });

  if (!cob.pixCopiaECola) {
    throw new Error("Inter PIX não retornou pixCopiaECola");
  }

  return {
    transactionId: cob.txid,
    copyPasteCode: cob.pixCopiaECola
  };
}

async function createC6Charge(input: CreatePixChargeInput): Promise<PixCharge> {
  const { c6CreateCobrancaImediata } = await import("./c6Pix");
  const { buildPixTxidFromSeed } = await import("./pixTxid");

  if (!isC6PixConfigured()) {
    throw new Error("C6 PIX não configurado (credenciais/certificados)");
  }

  const txid = buildPixTxidFromSeed(input.transactionId);
  const cpfDigits = input.payerCpf.replace(/\D/g, "").slice(0, 11);

  const cob = await c6CreateCobrancaImediata({
    txid,
    amount: input.amount,
    solicitacaoPagador: input.description,
    expiracaoSegundos: process.env.C6_PIX_EXPIRACAO_SEGUNDOS
      ? Number(process.env.C6_PIX_EXPIRACAO_SEGUNDOS)
      : undefined,
    devedor:
      cpfDigits.length === 11
        ? {
            cpf: cpfDigits,
            nome: input.payerName.slice(0, 80)
          }
        : undefined
  });

  if (!cob.pixCopiaECola) {
    throw new Error("C6 PIX não retornou pixCopiaECola");
  }

  return {
    transactionId: cob.txid,
    copyPasteCode: cob.pixCopiaECola
  };
}
