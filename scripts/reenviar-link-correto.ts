// Reenvia a cobrança com o link CORRETO para quem recebeu o link errado hoje.
// O disparo local usou o NEXT_PUBLIC_APP_URL do .env (IP da rede), gerando
// http://192.168.x.x:3000/pagar. Aqui forçamos o domínio público antes de
// importar qualquer módulo que leia getPublicAppUrl().
process.env.NEXT_PUBLIC_APP_URL = "https://crediarioms.com";

import { PrismaClient } from "@prisma/client";
import { calendarDayKeyBR } from "../src/lib/finance";

const prisma = new PrismaClient();

async function main() {
  const hojeKey = calendarDayKeyBR(new Date());

  // Parcelas avisadas HOJE — receberam o link errado.
  const todas = await prisma.parcela.findMany({
    where: {
      status: { in: ["pendente", "vencida"] },
      ultimo_aviso_em: { not: null }
    },
    select: { id: true, ultimo_aviso_em: true }
  });

  const avisadasHoje = todas.filter(
    (p) => p.ultimo_aviso_em && calendarDayKeyBR(p.ultimo_aviso_em) === hojeKey
  );

  console.log(`Parcelas avisadas hoje (link errado): ${avisadasHoje.length}`);

  // Libera para reenvio: zera o carimbo do último aviso para não cair no
  // guard "já avisado hoje". Os contadores de aviso ficam como estão.
  await prisma.parcela.updateMany({
    where: { id: { in: avisadasHoje.map((p) => p.id) } },
    data: { ultimo_aviso_em: null }
  });

  const { processarCobrancaAutomatica } = await import(
    "../src/lib/services/cobranca-automatica"
  );

  const resultado = await processarCobrancaAutomatica();
  console.log("Reenvio:", {
    processadas: resultado.processadas,
    enviadas: resultado.enviadas,
    ignoradas: resultado.ignoradas,
    erros: resultado.erros
  });

  const erros = resultado.detalhes.filter((d) => d.fase !== "nenhuma" && d.motivo);
  if (erros.length) console.log("Erros de envio:", erros.slice(0, 5));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => process.exit(0));
