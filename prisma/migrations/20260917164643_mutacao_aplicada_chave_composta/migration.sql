-- AlterTable
ALTER TABLE "mutacoes_aplicadas" DROP CONSTRAINT "mutacoes_aplicadas_pkey",
ADD CONSTRAINT "mutacoes_aplicadas_pkey" PRIMARY KEY ("id", "usuarioId");
