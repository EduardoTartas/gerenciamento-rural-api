-- Lançamento automático do consumo diário de insumo (issue #72): colunas novas,
-- nada existente muda. Os regimes de antes continuam manuais (padrão falso).
-- AlterTable
ALTER TABLE "regimes_consumo_insumo" ADD COLUMN "lancamentoAutomatico" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "movimentacoes_insumo" ADD COLUMN "regimeConsumoId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "movimentacoes_insumo_regimeConsumoId_data_key" ON "movimentacoes_insumo"("regimeConsumoId", "data");

-- AddForeignKey
ALTER TABLE "movimentacoes_insumo" ADD CONSTRAINT "movimentacoes_insumo_regimeConsumoId_fkey" FOREIGN KEY ("regimeConsumoId") REFERENCES "regimes_consumo_insumo"("id") ON DELETE SET NULL ON UPDATE CASCADE;
