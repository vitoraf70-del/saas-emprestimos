-- Contadores de avisos automáticos por WhatsApp
ALTER TABLE "Parcela" ADD COLUMN "avisos_antecipados" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Parcela" ADD COLUMN "avisos_vencimento" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Parcela" ADD COLUMN "avisos_atraso" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Parcela" ADD COLUMN "ultimo_aviso_em" TIMESTAMP(3);
