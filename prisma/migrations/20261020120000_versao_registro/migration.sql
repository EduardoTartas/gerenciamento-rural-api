-- Versão do registro (issue #76): base da detecção de conflito de edição no sync.
-- Só acrescenta uma coluna com default nas tabelas que aceitam UPDATE no lote;
-- linhas existentes entram na versão 1. Nenhum índice (inclusive os parciais de
-- nome) é tocado.
-- AlterTable
ALTER TABLE "propriedades" ADD COLUMN "versao" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "pastos" ADD COLUMN "versao" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "insumos" ADD COLUMN "versao" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "rebanhos" ADD COLUMN "versao" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "manejo_pastos" ADD COLUMN "versao" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "manejo_rebanhos" ADD COLUMN "versao" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "movimentacoes_insumo" ADD COLUMN "versao" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "regimes_consumo_insumo" ADD COLUMN "versao" INTEGER NOT NULL DEFAULT 1;
