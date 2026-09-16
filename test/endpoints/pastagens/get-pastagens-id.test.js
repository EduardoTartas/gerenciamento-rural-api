import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { api } from '../../apoio/cliente.js';
import { criarUsuario } from '../../apoio/auth.js';
import { criarPropriedade, criarPasto } from '../../apoio/fabricas.js';

describe('GET /v1/pastagens/:id', () => {
    let a;
    let propriedade;

    beforeEach(async () => {
        a = await criarUsuario();
        propriedade = await criarPropriedade(a.id);
    });

    const get = (usuario, id) =>
        api().get(`/v1/pastagens/${id}`).set('Authorization', usuario.bearer);

    it('PAST-GET-ID-01 retorna pasto existente do usuário autenticado', async () => {
        const pasto = await criarPasto(propriedade.id);
        const r = await get(a, pasto.id);
        expect(r.status).toBe(200);
        expect(r.body.message).toBe('Pastagem encontrada com sucesso.');
        expect(r.body.data.propriedade).toMatchObject({ id: propriedade.id, nome: propriedade.nome });
    });

    it('PAST-GET-ID-02 pasto inativo (soft-deleted) do próprio dono ainda pode ser lido por id', async () => {
        const pasto = await criarPasto(propriedade.id, { ativo: false });
        const r = await get(a, pasto.id);
        expect(r.status).toBe(200);
        expect(r.body.data.ativo).toBe(false);
    });

    it('PAST-GET-ID-03 id inexistente', async () => {
        const r = await get(a, randomUUID());
        expect(r.status).toBe(404);
        expect(r.body.tipo).toBe('resourceNotFound');
        expect(r.body.message).toBe('Recurso não encontrado em Pastagem.');
    });

    it('PAST-GET-ID-04 multi-tenancy: B tenta ler pasto de A', async () => {
        const pasto = await criarPasto(propriedade.id);
        const b = await criarUsuario();
        const r = await get(b, pasto.id);
        expect(r.status).toBe(404);
        expect(r.body.tipo).toBe('resourceNotFound');
        expect(r.body.message).toBe('Recurso não encontrado em Pastagem.');
    });

    it('PAST-GET-ID-05 :id não é UUID válido', async () => {
        const r = await get(a, 'nao-uuid');
        expect(r.status).toBe(400);
        expect(r.body.errors[0].message).toBe('ID de pastagem inválido. Deve ser um UUID válido.');
    });

    it('PAST-GET-ID-06 sem token', async () => {
        const pasto = await criarPasto(propriedade.id);
        const r = await api().get(`/v1/pastagens/${pasto.id}`);
        expect(r.status).toBe(401);
        expect(r.body.tipo).toBe('unauthorized');
    });
});
