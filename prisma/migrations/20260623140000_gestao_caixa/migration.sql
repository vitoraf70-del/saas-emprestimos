-- CreateEnum
CREATE TYPE "TipoMovimentacaoCaixa" AS ENUM ('novo_emprestimo', 'renovacao', 'recebimento');

-- CreateTable
CREATE TABLE "ConfigCaixa" (
    "id" TEXT NOT NULL,
    "saldo_inicial" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConfigCaixa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MovimentacaoCaixa" (
    "id" TEXT NOT NULL,
    "tipo" "TipoMovimentacaoCaixa" NOT NULL,
    "valor" DECIMAL(12,2) NOT NULL,
    "descricao" TEXT,
    "emprestimo_id" TEXT,
    "parcela_id" TEXT,
    "pagamento_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MovimentacaoCaixa_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MovimentacaoCaixa_pagamento_id_key" ON "MovimentacaoCaixa"("pagamento_id");

-- CreateIndex
CREATE INDEX "MovimentacaoCaixa_tipo_idx" ON "MovimentacaoCaixa"("tipo");

-- CreateIndex
CREATE INDEX "MovimentacaoCaixa_created_at_idx" ON "MovimentacaoCaixa"("created_at");

-- AddForeignKey
ALTER TABLE "MovimentacaoCaixa" ADD CONSTRAINT "MovimentacaoCaixa_emprestimo_id_fkey" FOREIGN KEY ("emprestimo_id") REFERENCES "Emprestimo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Config padrão
INSERT INTO "ConfigCaixa" ("id", "saldo_inicial", "updated_at")
VALUES ('default', 0, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

-- Histórico: saídas em novos empréstimos
INSERT INTO "MovimentacaoCaixa" ("id", "tipo", "valor", "descricao", "emprestimo_id", "created_at")
SELECT
    'bf_novo_' || e."id",
    'novo_emprestimo',
    COALESCE(e."valor_principal_base", e."valor_emprestado"),
    'Novo empréstimo (histórico)',
    e."id",
    e."created_at"
FROM "Emprestimo" e
WHERE NOT EXISTS (
    SELECT 1 FROM "MovimentacaoCaixa" m
    WHERE m."emprestimo_id" = e."id" AND m."tipo" = 'novo_emprestimo'
);

-- Histórico: entradas por recebimentos confirmados
INSERT INTO "MovimentacaoCaixa" ("id", "tipo", "valor", "descricao", "parcela_id", "pagamento_id", "emprestimo_id", "created_at")
SELECT
    'bf_rec_' || p."id",
    'recebimento',
    p."valor_pago",
    'Recebimento (histórico)',
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
