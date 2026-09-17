import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { api } from '../../apoio/cliente.js';
import { criarUsuario } from '../../apoio/auth.js';

describe('GET /v1/usuarios/:id', () => {
    const get = (usuario, id) => api().get(`/v1/usuarios/${id}`).set('Authorization', usuario.bearer);

    it('USR-GET-ID-01 usuário consulta o próprio ID', async () => {
        const a = await criarUsuario();
        const r = await get(a, a.id);
        expect(r.status).toBe(200);
        expect(r.body.data.id).toBe(a.id);
        expect(r.body.message).toBe('Usuário encontrado com sucesso.');
    });

    it('USR-GET-ID-02 admin consulta ID de outro usuário', async () => {
        const admin = await criarUsuario({ admin: true });
        const a = await criarUsuario();
        const r = await get(admin, a.id);
        expect(r.status).toBe(200);
        expect(r.body.data.id).toBe(a.id);
    });

    it('USR-GET-ID-03 usuário comum tenta consultar outro usuário', async () => {
        const a = await criarUsuario();
        const b = await criarUsuario();
        const r = await get(a, b.id);
        expect(r.status).toBe(403);
        expect(r.body.tipo).toBe('forbidden');
        expect(r.body.message).toBe('Você não tem permissão para consultar os dados de outro usuário.');
    });

    it('USR-GET-ID-04 ID em formato inválido (não UUID)', async () => {
        const a = await criarUsuario();
        const r = await get(a, 'abc');
        expect(r.status).toBe(400);
        expect(r.body.tipo).toBe('validationError');
    });

    it('USR-GET-ID-05 UUID válido mas inexistente', async () => {
        const a = await criarUsuario();
        const r = await get(a, randomUUID());
        expect(r.status).toBe(404);
        expect(r.body.tipo).toBe('resourceNotFound');
    });

    it('USR-GET-ID-06 401 sem token', async () => {
        const r = await api().get(`/v1/usuarios/${randomUUID()}`);
        expect(r.status).toBe(401);
        expect(r.body.tipo).toBe('unauthorized');
    });
});
