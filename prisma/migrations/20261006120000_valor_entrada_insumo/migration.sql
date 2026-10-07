-- Valor pago na entrada de insumo (issue #70): coluna nula, linhas existentes intactas.
-- AlterTable
ALTER TABLE "movimentacoes_insumo" ADD COLUMN     "valorTotal" DECIMAL(65,30);
