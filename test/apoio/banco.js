// URL do banco de teste. Nunca o banco de desenvolvimento.
import { existsSync } from 'node:fs';

// Só derivamos a URL de teste a partir de um host local conhecido. Sem isso, um
// `DATABASE_URL` apontando para o banco de produção faria `npm test` criar a base
// de teste e rodar migrations lá — o `globalSetup` conecta como administrador.
// Para qualquer outro host, o caminho é declarar `DATABASE_URL_TESTE`.
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
        // No host, o nome de serviço do compose não resolve: o Postgres do
        // docker-compose.dev.yml fica exposto em localhost:5433.
        if (url.hostname === 'postgresql' && !existsSync('/.dockerenv')) {
            url.hostname = 'localhost';
            url.port = '5433';
        }
    }

    // Guarda única, válida também para quem chamar esta função no futuro: os
    // chamadores repetem a checagem, mas ninguém depende só deles.
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
