// URL do banco de teste. Nunca o banco de desenvolvimento.
import { existsSync } from 'node:fs';

const HOSTS_LOCAIS = ['localhost', '127.0.0.1', '::1', 'postgresql'];

export function urlDoBancoDeTeste() {
    const url = new URL(process.env.DATABASE_URL_TESTE ?? process.env.DATABASE_URL);

    if (!process.env.DATABASE_URL_TESTE) {
        if (!HOSTS_LOCAIS.includes(url.hostname)) {
            throw new Error(
                `Host '${url.hostname}' não é local: defina DATABASE_URL_TESTE para rodar os testes de endpoint.`,
            );
        }
        url.pathname = '/pasto_livre_teste';
        if (url.hostname === 'postgresql' && !existsSync('/.dockerenv')) {
            url.hostname = 'localhost';
            url.port = '5433';
        }
    }

    if (!url.pathname.startsWith('/pasto_livre_teste')) {
        throw new Error(
            `Banco de teste precisa começar com pasto_livre_teste: ${url.pathname.slice(1)}`,
        );
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
