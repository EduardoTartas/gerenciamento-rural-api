/*
  Warnings:

  - You are about to drop the column `categoriaId` on the `rebanhos` table. All the data in the column will be lost.
  - You are about to drop the `categorias_rebanho` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "rebanhos" DROP CONSTRAINT "rebanhos_categoriaId_fkey";

-- AlterTable
ALTER TABLE "rebanhos" DROP COLUMN "categoriaId";

-- DropTable
DROP TABLE "categorias_rebanho";
