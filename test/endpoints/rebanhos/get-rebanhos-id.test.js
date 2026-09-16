import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { api } from '../../apoio/cliente.js';
import { criarUsuario } from '../../apoio/auth.js';
import { criarPropriedade, criarPasto, criarRebanho } from '../../apoio/fabricas.js';

describe('GET /v1/rebanhos/:id', () => {
    let a;
    let propriedade;
    let pasto;

    beforeEach(async () => {
        a = await criarUsuario();
        propriedade = await criarPropriedade(a.id);
        pasto = await criarPasto(propriedade.id);
    });

    const get = (usuario, id) =>
        api().get(`/v1/rebanhos/${id}`).set('Authorization', usuario.bearer);

    it('REB-GET-ID-01 busca rebanho de A', async () => {
        const rebanho = await criarRebanho(propriedade.id, pasto.id);
        const r = await get(a, rebanho.id);
        expect(r.status).toBe(200);
        expect(r.body.message).toBe('Rebanho encontrado com sucesso.');
        expect(r.body.data.propriedade).toMatchObject({ id: propriedade.id });
        expect(r.body.data.pastoAtual).toMatchObject({ id: pasto.id });
        expect(r.body.data).toHaveProperty('raca');
        expect(r.body.data).toHaveProperty('sistemaProducao');
        expect(r.body.data).toHaveProperty('regimeAlimentar');
    });

    it('REB-GET-ID-02 id não é UUID', async () => {
        const r = await get(a, 'abc');
        expect(r.status).toBe(400);
    });

    it('REB-GET-ID-03 id inexistente', async () => {
        const r = await get(a, randomUUID());
        expect(r.status).toBe(404);
        expect(r.body.tipo).toBe('resourceNotFound');
    });

    it('REB-GET-ID-04 sem token', async () => {
        const rebanho = await criarRebanho(propriedade.id, pasto.id);
        const r = await api().get(`/v1/rebanhos/${rebanho.id}`);
        expect(r.status).toBe(401);
        expect(r.body.tipo).toBe('unauthorized');
    });

    it('REB-GET-ID-05 multi-tenancy: B busca rebanho de A', async () => {
        const rebanho = await criarRebanho(propriedade.id, pasto.id);
        const b = await criarUsuario();
        const r = await get(b, rebanho.id);
        expect(r.status).toBe(404);
        expect(r.body.tipo).toBe('resourceNotFound');
    });

    it('REB-GET-ID-06 admin (não dono) busca rebanho de A', async () => {
        const rebanho = await criarRebanho(propriedade.id, pasto.id);
        const admin = await criarUsuario({ admin: true });
        const r = await get(admin, rebanho.id);
        expect(r.status).toBe(404);
        expect(r.body.tipo).toBe('resourceNotFound');
    });
});
