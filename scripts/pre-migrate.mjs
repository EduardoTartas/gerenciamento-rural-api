// scripts/pre-migrate.mjs
// Corrige a migration 20260425203126_rebanho_catalogos_globais se estiver pendente.
// Essa migration falha em produção porque tenta adicionar colunas NOT NULL sem DEFAULT
// em tabelas que podem ter dados existentes.

import pg from 'pg';
import { execSync } from 'child_process';

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const MIGRATION = '20260425203126_rebanho_catalogos_globais';

async function applyFix(client) {
    console.log(`[pre-migrate] Aplicando fix para ${MIGRATION}...`);

    await client.query('BEGIN');

    // Limpa tabelas que receberão NOT NULL: dados inválidos pois tipoManejoId não existia
    await client.query('DELETE FROM manejo_pastos');
    await client.query('DELETE FROM manejo_rebanhos');

    // historico_movimentacoes
    await client.query(`ALTER TABLE historico_movimentacoes ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP`);

    // manejo_pastos
    await client.query(`ALTER TABLE manejo_pastos DROP COLUMN IF EXISTS "tipoManejo"`);
    await client.query(`ALTER TABLE manejo_pastos ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP`);
    await client.query(`ALTER TABLE manejo_pastos ADD COLUMN IF NOT EXISTS "tipoManejoId" TEXT NOT NULL DEFAULT ''`);
    await client.query(`ALTER TABLE manejo_pastos ALTER COLUMN "tipoManejoId" DROP DEFAULT`);
    await client.query(`ALTER TABLE manejo_pastos ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()`);
    await client.query(`ALTER TABLE manejo_pastos ALTER COLUMN "updatedAt" DROP DEFAULT`);

    // manejo_rebanhos
    await client.query(`ALTER TABLE manejo_rebanhos DROP COLUMN IF EXISTS "tipoManejo"`);
    await client.query(`ALTER TABLE manejo_rebanhos ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP`);
    await client.query(`ALTER TABLE manejo_rebanhos ADD COLUMN IF NOT EXISTS "tipoManejoId" TEXT NOT NULL DEFAULT ''`);
    await client.query(`ALTER TABLE manejo_rebanhos ALTER COLUMN "tipoManejoId" DROP DEFAULT`);
    await client.query(`ALTER TABLE manejo_rebanhos ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()`);
    await client.query(`ALTER TABLE manejo_rebanhos ALTER COLUMN "updatedAt" DROP DEFAULT`);

    // rebanhos
    await client.query(`ALTER TABLE rebanhos DROP COLUMN IF EXISTS categoria`);
    await client.query(`ALTER TABLE rebanhos DROP COLUMN IF EXISTS raca`);
    await client.query(`ALTER TABLE rebanhos ADD COLUMN IF NOT EXISTS "categoriaId" TEXT`);
    await client.query(`ALTER TABLE rebanhos ADD COLUMN IF NOT EXISTS "racaId" TEXT`);
    await client.query(`ALTER TABLE rebanhos ADD COLUMN IF NOT EXISTS "regimeAlimentarId" TEXT`);
    await client.query(`ALTER TABLE rebanhos ADD COLUMN IF NOT EXISTS "sistemaProducaoId" TEXT`);

    // Tabelas de catálogo
    for (const [table, constraint] of [
        ['racas', 'racas_pkey'],
        ['categorias_rebanho', 'categorias_rebanho_pkey'],
        ['sistemas_producao', 'sistemas_producao_pkey'],
        ['regimes_alimentares', 'regimes_alimentares_pkey'],
        ['tipos_manejo_rebanho', 'tipos_manejo_rebanho_pkey'],
        ['tipos_manejo_pasto', 'tipos_manejo_pasto_pkey'],
    ]) {
        await client.query(`
            CREATE TABLE IF NOT EXISTS ${table} (
                id TEXT NOT NULL,
                nome TEXT NOT NULL,
                ativo BOOLEAN NOT NULL DEFAULT true,
                "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
                CONSTRAINT "${constraint}" PRIMARY KEY (id)
            )
        `);
        await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS "${table}_nome_key" ON ${table}(nome)`);
    }

    // FKs (idempotente via DO $$)
    await client.query(`
        DO $$ BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'rebanhos_racaId_fkey') THEN
                ALTER TABLE rebanhos ADD CONSTRAINT "rebanhos_racaId_fkey" FOREIGN KEY ("racaId") REFERENCES racas(id) ON DELETE SET NULL ON UPDATE CASCADE;
            END IF;
            IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'rebanhos_sistemaProducaoId_fkey') THEN
                ALTER TABLE rebanhos ADD CONSTRAINT "rebanhos_sistemaProducaoId_fkey" FOREIGN KEY ("sistemaProducaoId") REFERENCES sistemas_producao(id) ON DELETE SET NULL ON UPDATE CASCADE;
            END IF;
            IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'rebanhos_regimeAlimentarId_fkey') THEN
                ALTER TABLE rebanhos ADD CONSTRAINT "rebanhos_regimeAlimentarId_fkey" FOREIGN KEY ("regimeAlimentarId") REFERENCES regimes_alimentares(id) ON DELETE SET NULL ON UPDATE CASCADE;
            END IF;
            IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'manejo_rebanhos_tipoManejoId_fkey') THEN
                ALTER TABLE manejo_rebanhos ADD CONSTRAINT "manejo_rebanhos_tipoManejoId_fkey" FOREIGN KEY ("tipoManejoId") REFERENCES tipos_manejo_rebanho(id) ON DELETE RESTRICT ON UPDATE CASCADE;
            END IF;
            IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'manejo_pastos_tipoManejoId_fkey') THEN
                ALTER TABLE manejo_pastos ADD CONSTRAINT "manejo_pastos_tipoManejoId_fkey" FOREIGN KEY ("tipoManejoId") REFERENCES tipos_manejo_pasto(id) ON DELETE RESTRICT ON UPDATE CASCADE;
            END IF;
        END $$
    `);

    // Marca a migration como aplicada com sucesso
    await client.query(`
        UPDATE _prisma_migrations
        SET finished_at = NOW(), execution_time_in_ms = 1, rolled_back_at = NULL
        WHERE migration_name = $1
    `, [MIGRATION]);

    await client.query('COMMIT');
    console.log(`[pre-migrate] Fix aplicado com sucesso.`);
}

async function main() {
    const client = await pool.connect();
    try {
        const { rows } = await client.query(`
            SELECT migration_name, finished_at, rolled_back_at
            FROM _prisma_migrations
            WHERE migration_name = $1
        `, [MIGRATION]);

        const isPending = rows.length > 0 && !rows[0].finished_at;

        if (isPending) {
            // Garante que está marcada como rolled_back antes de re-aplicar
            await client.query(`
                UPDATE _prisma_migrations SET rolled_back_at = NOW()
                WHERE migration_name = $1 AND finished_at IS NULL
            `, [MIGRATION]);
            await applyFix(client);
        } else {
            console.log('[pre-migrate] Nenhuma migration pendente. Prosseguindo.');
        }
    } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        console.error('[pre-migrate] ERRO:', err.message);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }

    console.log('[pre-migrate] Rodando prisma migrate deploy...');
    execSync('npx prisma migrate deploy', { stdio: 'inherit' });
    console.log('[pre-migrate] Concluído. Iniciando servidor...');
}

main();
