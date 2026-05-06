-- CreateEnum
CREATE TYPE "StatusEmprestimo" AS ENUM ('ativo', 'quitado', 'inadimplente');

-- CreateEnum
CREATE TYPE "StatusParcela" AS ENUM ('pendente', 'paga', 'vencida');

-- CreateEnum
CREATE TYPE "MetodoPagamento" AS ENUM ('pix');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "passwordHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "Cliente" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "cpf" TEXT NOT NULL,
    "endereco" TEXT NOT NULL,
    "whatsapp" TEXT NOT NULL,
    "referencia1_nome" TEXT,
    "referencia1_telefone" TEXT,
    "referencia2_nome" TEXT,
    "referencia2_telefone" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Cliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Emprestimo" (
    "id" TEXT NOT NULL,
    "cliente_id" TEXT NOT NULL,
    "valor_emprestado" DECIMAL(12,2) NOT NULL,
    "taxa_juros_percentual" DECIMAL(5,2) NOT NULL,
    "numero_parcelas" INTEGER NOT NULL,
    "valor_parcela" DECIMAL(12,2) NOT NULL,
    "data_inicio" TIMESTAMP(3) NOT NULL,
    "vencimento_dia" INTEGER NOT NULL,
    "multa_percentual" DECIMAL(5,2) NOT NULL DEFAULT 2,
    "juros_dia_percentual" DECIMAL(5,2) NOT NULL DEFAULT 0.33,
    "status" "StatusEmprestimo" NOT NULL DEFAULT 'ativo',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Emprestimo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Parcela" (
    "id" TEXT NOT NULL,
    "emprestimo_id" TEXT NOT NULL,
    "numero_parcela" INTEGER NOT NULL,
    "valor_original" DECIMAL(12,2) NOT NULL,
    "vencimento" TIMESTAMP(3) NOT NULL,
    "data_pagamento" TIMESTAMP(3),
    "dias_atraso" INTEGER NOT NULL DEFAULT 0,
    "multa_valor" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "juros_valor" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "valor_atualizado" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "status" "StatusParcela" NOT NULL DEFAULT 'pendente',

    CONSTRAINT "Parcela_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pagamento" (
    "id" TEXT NOT NULL,
    "parcela_id" TEXT NOT NULL,
    "valor_pago" DECIMAL(12,2) NOT NULL,
    "metodo" "MetodoPagamento" NOT NULL DEFAULT 'pix',
    "transaction_id" TEXT NOT NULL,
    "data_pagamento" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL,

    CONSTRAINT "Pagamento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "Cliente_cpf_key" ON "Cliente"("cpf");

-- CreateIndex
CREATE UNIQUE INDEX "Parcela_emprestimo_id_numero_parcela_key" ON "Parcela"("emprestimo_id", "numero_parcela");

-- CreateIndex
CREATE UNIQUE INDEX "Pagamento_transaction_id_key" ON "Pagamento"("transaction_id");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Emprestimo" ADD CONSTRAINT "Emprestimo_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Parcela" ADD CONSTRAINT "Parcela_emprestimo_id_fkey" FOREIGN KEY ("emprestimo_id") REFERENCES "Emprestimo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pagamento" ADD CONSTRAINT "Pagamento_parcela_id_fkey" FOREIGN KEY ("parcela_id") REFERENCES "Parcela"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
