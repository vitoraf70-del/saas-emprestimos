// Disparo manual: força o domínio público para o link do WhatsApp NUNCA sair
// com o IP da rede local (NEXT_PUBLIC_APP_URL do .env de dev). Sobrescreva com
// APP_URL_OVERRIDE se rodar em outro ambiente.
process.env.NEXT_PUBLIC_APP_URL =
  process.env.APP_URL_OVERRIDE ?? "https://crediarioms.com";

import {
  contarCobrancasPendentes,
  processarCobrancaAutomatica
} from "../src/lib/services/cobranca-automatica";

const MAX_ROUNDS = 50;

async function main() {
  let totalEnviadas = 0;
  let totalErros = 0;

  for (let round = 1; round <= MAX_ROUNDS; round++) {
    const antes = await contarCobrancasPendentes();
    const resultado = await processarCobrancaAutomatica();
    totalEnviadas += resultado.enviadas;
    totalErros += resultado.erros;

    console.log(`\n--- Rodada ${round} ---`);
    console.log({
      filaAntes: antes,
      processadas: resultado.processadas,
      enviadas: resultado.enviadas,
      ignoradas: resultado.ignoradas,
      erros: resultado.erros,
      pendentesExecucao: resultado.pendentes
    });

    if (resultado.erros > 0) {
      const erros = resultado.detalhes.filter((d) => d.motivo);
      console.log("Erros:", erros.slice(0, 5));
    }

    const depois = await contarCobrancasPendentes();
    if (depois === 0 && resultado.pendentes === 0) {
      console.log("\nFila esvaziada.");
      break;
    }
    if (resultado.enviadas === 0 && resultado.pendentes === 0) {
      console.log(`\nParado: ainda ${depois} na fila (fora de horário ou já avisados hoje).`);
      break;
    }
  }

  const restantes = await contarCobrancasPendentes();
  console.log("\n=== Resumo ===");
  console.log({ totalEnviadas, totalErros, restantes });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => process.exit(0));
