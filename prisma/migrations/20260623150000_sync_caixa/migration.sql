-- Remove movimentações órfãs que inflavam o caixa
DELETE FROM "MovimentacaoCaixa"
WHERE tipo = 'novo_emprestimo'
  AND (
    emprestimo_id IS NULL
    OR NOT EXISTS (SELECT 1 FROM "Emprestimo" e WHERE e.id = "MovimentacaoCaixa".emprestimo_id)
  );

DELETE FROM "MovimentacaoCaixa"
WHERE tipo = 'recebimento'
  AND (
    pagamento_id IS NULL
    OR NOT EXISTS (
      SELECT 1 FROM "Pagamento" p
      WHERE p.id = "MovimentacaoCaixa".pagamento_id AND p.status = 'confirmado'
    )
  );

-- Sincroniza recebimentos faltantes no livro-caixa
INSERT INTO "MovimentacaoCaixa" ("id", "tipo", "valor", "descricao", "parcela_id", "pagamento_id", "emprestimo_id", "created_at")
SELECT
    'sync_rec_' || p."id",
    'recebimento',
    p."valor_pago",
    'Recebimento (sincronizado)',
    p."parcela_id",
    p."id",
    par."emprestimo_id",
    COALESCE(p."data_pagamento", CURRENT_TIMESTAMP)
FROM "Pagamento" p
JOIN "Parcela" par ON par."id" = p."parcela_id"
WHERE p."status" = 'confirmado'
  AND NOT EXISTS (
    SELECT 1 FROM "MovimentacaoCaixa" m WHERE m."pagamento_id" = p."id"
  );
