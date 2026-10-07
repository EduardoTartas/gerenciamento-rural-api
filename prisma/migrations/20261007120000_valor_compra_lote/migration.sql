-- Valor de compra do lote (issue #71): colunas nulas, lotes existentes intactos.
-- AlterTable
ALTER TABLE "rebanhos" ADD COLUMN     "cabecasCompra" INTEGER,
ADD COLUMN     "dataCompra" TIMESTAMP(3),
ADD COLUMN     "pesoCompraKg" DECIMAL(65,30),
ADD COLUMN     "precoArrobaCompra" DECIMAL(65,30),
ADD COLUMN     "valorCompra" DECIMAL(65,30);
