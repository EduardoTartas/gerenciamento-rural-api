-- Coluna declarada no schema.prisma e usada em Zod/repository desde sempre, mas nunca
-- teve migration correspondente. Toda consulta a propriedades quebrava em runtime.
ALTER TABLE "propriedades" ADD COLUMN "areaTotalHa" DECIMAL(65,30);
