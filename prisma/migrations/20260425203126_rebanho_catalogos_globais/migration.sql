/*
  Warnings:

  - You are about to drop the column `tipoManejo` on the `manejo_pastos` table. All the data in the column will be lost.
  - You are about to drop the column `tipoManejo` on the `manejo_rebanhos` table. All the data in the column will be lost.
  - You are about to drop the column `categoria` on the `rebanhos` table. All the data in the column will be lost.
  - You are about to drop the column `raca` on the `rebanhos` table. All the data in the column will be lost.
  - Added the required column `tipoManejoId` to the `manejo_pastos` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `manejo_pastos` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tipoManejoId` to the `manejo_rebanhos` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `manejo_rebanhos` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "historico_movimentacoes" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "manejo_pastos" DROP COLUMN "tipoManejo",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "tipoManejoId" TEXT NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "manejo_rebanhos" DROP COLUMN "tipoManejo",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "tipoManejoId" TEXT NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "rebanhos" DROP COLUMN "categoria",
DROP COLUMN "raca",
ADD COLUMN     "categoriaId" TEXT,
ADD COLUMN     "racaId" TEXT,
ADD COLUMN     "regimeAlimentarId" TEXT,
ADD COLUMN     "sistemaProducaoId" TEXT;

-- CreateTable
CREATE TABLE "racas" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "racas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categorias_rebanho" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categorias_rebanho_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sistemas_producao" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sistemas_producao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "regimes_alimentares" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "regimes_alimentares_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tipos_manejo_rebanho" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tipos_manejo_rebanho_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tipos_manejo_pasto" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tipos_manejo_pasto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "racas_nome_key" ON "racas"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "categorias_rebanho_nome_key" ON "categorias_rebanho"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "sistemas_producao_nome_key" ON "sistemas_producao"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "regimes_alimentares_nome_key" ON "regimes_alimentares"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "tipos_manejo_rebanho_nome_key" ON "tipos_manejo_rebanho"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "tipos_manejo_pasto_nome_key" ON "tipos_manejo_pasto"("nome");

-- AddForeignKey
ALTER TABLE "rebanhos" ADD CONSTRAINT "rebanhos_racaId_fkey" FOREIGN KEY ("racaId") REFERENCES "racas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rebanhos" ADD CONSTRAINT "rebanhos_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "categorias_rebanho"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rebanhos" ADD CONSTRAINT "rebanhos_sistemaProducaoId_fkey" FOREIGN KEY ("sistemaProducaoId") REFERENCES "sistemas_producao"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rebanhos" ADD CONSTRAINT "rebanhos_regimeAlimentarId_fkey" FOREIGN KEY ("regimeAlimentarId") REFERENCES "regimes_alimentares"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manejo_rebanhos" ADD CONSTRAINT "manejo_rebanhos_tipoManejoId_fkey" FOREIGN KEY ("tipoManejoId") REFERENCES "tipos_manejo_rebanho"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manejo_pastos" ADD CONSTRAINT "manejo_pastos_tipoManejoId_fkey" FOREIGN KEY ("tipoManejoId") REFERENCES "tipos_manejo_pasto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
