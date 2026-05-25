-- CreateEnum
CREATE TYPE "TipoOcupacao" AS ENUM ('comerciante', 'motorista_app', 'autonomo', 'funcionario_clt', 'outro');

-- AlterTable
ALTER TABLE "Cliente" ADD COLUMN "tipo_ocupacao" "TipoOcupacao",
ADD COLUMN "ocupacao_detalhe" TEXT,
ADD COLUMN "origem_cadastro" TEXT;

-- CreateTable
CREATE TABLE "WhatsappConversa" (
    "id" TEXT NOT NULL,
    "telefone" TEXT NOT NULL,
    "etapa" TEXT NOT NULL,
    "dados" JSONB NOT NULL DEFAULT '{}',
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WhatsappConversa_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WhatsappConversa_telefone_key" ON "WhatsappConversa"("telefone");
