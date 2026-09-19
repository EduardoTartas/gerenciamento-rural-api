import { describe, expect, it } from 'vitest';
import { api } from '../../apoio/cliente.js';
import { criarUsuario } from '../../apoio/auth.js';

describe('GET /v1/usuarios', () => {
    const get = (usuario, query = '') =>
        api().get(`/v1/usuarios${query}`).set('Authorization', usuario.bearer);

    it('USR-GET-01 admin lista usuários', async () => {
        const admin = await criarUsuario({ admin: true });
        const b = await criarUsuario();
        const r = await get(admin);
        expect(r.status).toBe(200);
        expect(r.body.errors).toEqual([]);
        expect(r.body.message).toBe('2 usuário(s) encontrado(s).');
        expect(r.body.data.docs).toHaveLength(2);
        const ids = r.body.data.docs.map((u) => u.id).sort();
        expect(ids).toEqual([admin.id, b.id].sort());
        for (const doc of r.body.data.docs) {
            expect(Object.keys(doc).sort()).toEqual(
                ['createdAt', 'email', 'emailVerified', 'id', 'image', 'name', 'updatedAt'].sort(),
            );
        }
    });

    it('USR-GET-02 filtra por name (contém, case-insensitive)', async () => {
        const admin = await criarUsuario({ admin: true });
        await criarUsuario({ nome: 'Eduardo Silva' });
        await criarUsuario({ nome: 'Outro Produtor' });
        const r = await get(admin, '?name=eduardo');
        expect(r.status).toBe(200);
        expect(r.body.data.docs).toHaveLength(1);
        expect(r.body.data.docs[0].name).toBe('Eduardo Silva');
    });

    it('USR-GET-03 filtra por email (contém, case-insensitive)', async () => {
        const admin = await criarUsuario({ admin: true });
        const alvo = await criarUsuario();
        await criarUsuario();
        const trecho = alvo.email.slice(6, 14).toUpperCase();
        const r = await get(admin, `?email=${trecho}`);
        expect(r.status).toBe(200);
        expect(r.body.data.docs).toHaveLength(1);
        expect(r.body.data.docs[0].email).toBe(alvo.email);
    });

    it('USR-GET-04 pagina com page/limit', async () => {
        const admin = await criarUsuario({ admin: true });
        for (let i = 0; i < 10; i += 1) {
            // eslint-disable-next-line no-await-in-loop
            await criarUsuario();
        }
        const r = await get(admin, '?page=2&limit=5');
        expect(r.status).toBe(200);
        expect(r.body.data.page).toBe(2);
        expect(r.body.data.limit).toBe(5);
        expect(r.body.data.totalPages).toBe(3);
        expect(r.body.data.docs).toHaveLength(5);
    });

    it('USR-GET-05 limit acima de 100 é rejeitado pelo schema', async () => {
        const admin = await criarUsuario({ admin: true });
        const r = await get(admin, '?limit=101');
        expect(r.status).toBe(400);
        expect(r.body.tipo).toBe('validationError');
    });

    it('USR-GET-06 campo de query não reconhecido (.strict())', async () => {
        const admin = await criarUsuario({ admin: true });
        const r = await get(admin, '?foo=bar');
        expect(r.status).toBe(400);
        expect(r.body.tipo).toBe('validationError');
    });

    it('USR-GET-07 401 sem token', async () => {
        const r = await api().get('/v1/usuarios');
        expect(r.status).toBe(401);
        expect(r.body.tipo).toBe('unauthorized');
    });

    it('USR-GET-08 403 usuário comum (não admin)', async () => {
        const a = await criarUsuario();
        const r = await get(a);
        expect(r.status).toBe(403);
        expect(r.body.tipo).toBe('forbidden');
        expect(r.body.message).toBe('Esta ação exige perfil administrativo.');
    });
});
