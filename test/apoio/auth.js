import { randomUUID } from 'node:crypto';
import DbConnect from '../../src/config/dbConnect.js';
import { api } from './cliente.js';

export const SENHA_PADRAO = 'SenhaTeste1';

export async function criarUsuario({ admin = false, nome = 'Produtor Teste' } = {}) {
    const email = `teste-${randomUUID()}@pastolivre.test`;
    const r = await api()
        .post('/api/auth/sign-up/email')
        .send({ name: nome, email, password: SENHA_PADRAO });
    if (r.status !== 200) throw new Error(`sign-up falhou: ${r.status} ${JSON.stringify(r.body)}`);

    const token = r.body.token ?? r.headers['set-auth-token'];
    const id = r.body.user.id;
    if (admin) await DbConnect.prisma.user.update({ where: { id }, data: { admin: true } });

    return { id, email, token, bearer: `Bearer ${token}` };
}
