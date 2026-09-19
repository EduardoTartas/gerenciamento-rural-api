import 'dotenv/config';
import { beforeEach, afterAll } from 'vitest';
import { urlDoBancoDeTeste } from './banco.js';

process.env.DATABASE_URL = urlDoBancoDeTeste();
if (!new URL(process.env.DATABASE_URL).pathname.startsWith('/pasto_livre_teste')) {
    throw new Error('Testes de endpoint recusam banco que não seja pasto_livre_teste*.');
}

const { default: DbConnect } = await import('../../src/config/dbConnect.js');
const { limparBanco } = await import('./banco.js');

beforeEach(() => limparBanco(DbConnect.prisma));
afterAll(() => DbConnect.disconnect());
