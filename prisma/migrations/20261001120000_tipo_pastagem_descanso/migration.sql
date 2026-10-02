-- Catálogo de tipo de pastagem com tempo de descanso por forrageira (#61).
--
-- `diasDescanso` é a média da faixa recomendada para o período das águas, sem considerar
-- solo, região e época do ano (Embrapa Cerrados, Comunicado Técnico 101, Tabela 2). É o
-- padrão sugerido: cada pasto pode ajustar no próprio `pastos.diasDescanso`.

-- CreateTable
CREATE TABLE "tipos_pastagem" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "diasDescanso" INTEGER NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tipos_pastagem_pkey" PRIMARY KEY ("id")
);

-- Unicidade de nome só entre os ativos, sem diferenciar maiúsculas — mesmo padrão dos
-- demais catálogos (`*_nome_ci_key`). Prisma não expressa índice parcial no schema.
CREATE UNIQUE INDEX "tipos_pastagem_nome_ci_key" ON "tipos_pastagem" (lower("nome")) WHERE ativo = true;

-- Catálogo base na própria migration, não só no seed: o deploy roda apenas
-- `prisma migrate deploy` (ver 20260924200000_seed_tipos_insumo). Os nomes são os
-- mesmos da lista fixa que o app usava, para os pastos existentes casarem abaixo.
-- Idempotente pelo índice parcial (WHERE NOT EXISTS, não ON CONFLICT).
INSERT INTO "tipos_pastagem" ("id", "nome", "diasDescanso", "ativo", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, t.nome, t.dias, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM (VALUES
    ('Brachiaria brizantha', 35),        -- 28 a 42
    ('Brachiaria decumbens', 35),        -- 28 a 42
    ('Brachiaria humidicola', 25),       -- 20 a 30
    ('Panicum maximum (Mombaça)', 35),   -- 28 a 42
    ('Panicum maximum (Tanzânia)', 35),  -- 28 a 42
    ('Tifton 85', 30),                   -- 25 a 35
    ('Coast-cross', 30),                 -- 25 a 35
    ('Capim-elefante', 38),              -- 30 a 45
    ('Andropógon', 28)                   -- 25 a 30
) AS t(nome, dias)
WHERE NOT EXISTS (
    SELECT 1 FROM "tipos_pastagem" e WHERE lower(e."nome") = lower(t.nome) AND e."ativo" = true
);

-- AlterTable: colunas novas antes de remover o texto livre, para copiar o dado.
ALTER TABLE "pastos" ADD COLUMN "diasDescanso" INTEGER,
ADD COLUMN "tipoPastagemId" TEXT;

-- Dado existente: o texto livre vira o id do catálogo quando o nome casa (sem diferenciar
-- maiúsculas e espaços nas pontas). "Outro" e nomes sem correspondência ficam sem tipo —
-- o pasto continua válido e usa o descanso padrão do app. `updatedAt` avança em todo pasto
-- que tinha texto, para o pull por diferença levar a mudança de coluna ao aparelho.
UPDATE "pastos" p
SET "tipoPastagemId" = t."id"
FROM "tipos_pastagem" t
WHERE p."tipoPastagem" IS NOT NULL
  AND t."ativo" = true
  AND lower(trim(p."tipoPastagem")) = lower(t."nome");

UPDATE "pastos" SET "updatedAt" = CURRENT_TIMESTAMP WHERE "tipoPastagem" IS NOT NULL;

ALTER TABLE "pastos" DROP COLUMN "tipoPastagem";

-- CreateIndex
CREATE INDEX "pastos_tipoPastagemId_idx" ON "pastos"("tipoPastagemId");

-- AddForeignKey
ALTER TABLE "pastos" ADD CONSTRAINT "pastos_tipoPastagemId_fkey" FOREIGN KEY ("tipoPastagemId") REFERENCES "tipos_pastagem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
