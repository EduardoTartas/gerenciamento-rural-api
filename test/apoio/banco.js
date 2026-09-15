// URL do banco de teste. Nunca o banco de desenvolvimento.
import { existsSync } from 'node:fs';

export function urlDoBancoDeTeste() {
    if (process.env.DATABASE_URL_TESTE) return process.env.DATABASE_URL_TESTE;

    const url = new URL(process.env.DATABASE_URL);
    url.pathname = '/pasto_livre_teste';
    // No host, o nome de serviço do compose não resolve: o Postgres do
    // docker-compose.dev.yml fica exposto em localhost:5433.
    if (url.hostname === 'postgresql' && !existsSync('/.dockerenv')) {
        url.hostname = 'localhost';
        url.port = '5433';
    }
    return url.toString();
}

export async function limparBanco(prisma) {
    const tabelas = await prisma.$queryRaw`
        SELECT tablename FROM pg_tables
        WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
    const lista = tabelas.map(({ tablename }) => `"public"."${tablename}"`).join(', ');
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${lista} RESTART IDENTITY CASCADE`);
}
