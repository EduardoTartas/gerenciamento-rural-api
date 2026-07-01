-- Drop o índice único incondicional antigo, se existir
DROP INDEX IF EXISTS "propriedades_usuarioId_nome_key";

-- Cria o índice único parcial permitindo repetição de nome apenas para propriedades inativas (ativo = false)
CREATE UNIQUE INDEX "propriedades_usuarioId_nome_key" ON "propriedades"("usuarioId", "nome") WHERE ativo = true;
