-- Catálogo base de tipos de insumo. Antes só o seed (prisma/seeds/catalogoSeed.js) o
-- populava, e o deploy roda apenas `prisma migrate deploy` — em produção o catálogo
-- ficou vazio e todo insumo criado era recusado com "Tipo de insumo não encontrado".
--
-- Idempotente: não duplica quando o tipo já existe ativo. Não usa ON CONFLICT porque a
-- unicidade é o índice parcial `tipos_insumo_nome_ci_key` (lower(nome) WHERE ativo).
INSERT INTO "tipos_insumo" ("id", "nome", "ativo", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, t.nome, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM (VALUES
    ('Ração'),
    ('Sal mineral'),
    ('Vacina'),
    ('Medicamento'),
    ('Fertilizante'),
    ('Semente'),
    ('Defensivo'),
    ('Suplemento'),
    ('Outro')
) AS t(nome)
WHERE NOT EXISTS (
    SELECT 1 FROM "tipos_insumo" e WHERE lower(e."nome") = lower(t.nome) AND e."ativo" = true
);
