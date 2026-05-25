-- CreateEnum
CREATE TYPE "StatusDespesaParcela" AS ENUM ('pendente', 'paga');

-- CreateTable
CREATE TABLE "Despesa" (
    "id" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "valor_total" DECIMAL(12,2) NOT NULL,
    "parcelado" BOOLEAN NOT NULL DEFAULT false,
    "numero_parcelas" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Despesa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DespesaParcela" (
    "id" TEXT NOT NULL,
    "despesa_id" TEXT NOT NULL,
    "numero_parcela" INTEGER NOT NULL,
    "valor" DECIMAL(12,2) NOT NULL,
    "vencimento" TIMESTAMP(3) NOT NULL,
    "data_pagamento" TIMESTAMP(3),
    "status" "StatusDespesaParcela" NOT NULL DEFAULT 'pendente',

    CONSTRAINT "DespesaParcela_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DespesaParcela_despesa_id_numero_parcela_key" ON "DespesaParcela"("despesa_id", "numero_parcela");

-- CreateIndex
CREATE INDEX "DespesaParcela_status_idx" ON "DespesaParcela"("status");

-- CreateIndex
CREATE INDEX "DespesaParcela_vencimento_idx" ON "DespesaParcela"("vencimento");

-- CreateIndex
CREATE INDEX "DespesaParcela_status_vencimento_idx" ON "DespesaParcela"("status", "vencimento");

-- AddForeignKey
ALTER TABLE "DespesaParcela" ADD CONSTRAINT "DespesaParcela_despesa_id_fkey" FOREIGN KEY ("despesa_id") REFERENCES "Despesa"("id") ON DELETE CASCADE ON UPDATE CASCADE;
