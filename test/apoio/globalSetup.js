import 'dotenv/config';
import { execSync } from 'node:child_process';
import pg from 'pg';
import { urlDoBancoDeTeste } from './banco.js';

export default async function preparar() {
    const url = new URL(urlDoBancoDeTeste());
    const nome = url.pathname.slice(1);
    if (!nome.startsWith('pasto_livre_teste')) {
        throw new Error(`Banco de teste precisa começar com pasto_livre_teste: ${nome}`);
    }

    const admin = new URL(url);
    admin.pathname = '/postgres';
    const cliente = new pg.Client({ connectionString: admin.toString() });
    await cliente.connect();
    const { rowCount } = await cliente.query('SELECT 1 FROM pg_database WHERE datname = $1', [nome]);
    if (rowCount === 0) await cliente.query(`CREATE DATABASE "${nome}"`);
    await cliente.end();

    execSync('npx prisma migrate deploy', {
        env: { ...process.env, DATABASE_URL: url.toString() },
        stdio: 'inherit',
    });
}
