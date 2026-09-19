import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { api } from '../../apoio/cliente.js';
import { criarUsuario } from '../../apoio/auth.js';
import { criarPropriedade, criarPasto, criarRebanho, criarInsumo } from '../../apoio/fabricas.js';
import { criarRegimeConsumo } from './apoio-local.js';

describe('GET /v1/rebanhos/regimes-consumo/:id', () => {
    let a, propriedade, pasto, rebanho, insumo;

    beforeEach(async () => {
        a = await criarUsuario();
        propriedade = await criarPropriedade(a.id);
        pasto = await criarPasto(propriedade.id);
        rebanho = await criarRebanho(propriedade.id, pasto.id);
        insumo = await criarInsumo(propriedade.id, { destino: 'Ambos' });
    });

    const get = (usuario, id) =>
        api().get(`/v1/rebanhos/regimes-consumo/${id}`).set('Authorization', usuario.bearer);

    it('REG-GET-ID-01 encontra por id', async () => {
        const regime = await criarRegimeConsumo(rebanho.id, insumo.id);

        const r = await get(a, regime.id);
        expect(r.status).toBe(200);
        expect(r.body.message).toBe('Regime de consumo encontrado com sucesso.');
        expect(r.body.data.id).toBe(regime.id);
        expect(r.body.data.insumo).toMatchObject({ id: insumo.id });
        expect(r.body.data.rebanho).toMatchObject({ id: rebanho.id });
    });

    it('REG-GET-ID-02 id não é UUID', async () => {
        const r = await get(a, 'nao-uuid');
        expect(r.status).toBe(400);
        expect(r.body.tipo).toBe('validationError');
    });

    it('REG-GET-ID-03 sem token', async () => {
        const regime = await criarRegimeConsumo(rebanho.id, insumo.id);
        const r = await api().get(`/v1/rebanhos/regimes-consumo/${regime.id}`);
        expect(r.status).toBe(401);
        expect(r.body.tipo).toBe('unauthorized');
    });

    it('REG-GET-ID-04 id inexistente', async () => {
        const r = await get(a, randomUUID());
        expect(r.status).toBe(404);
        expect(r.body.message).toBe('Recurso não encontrado em Regime de Consumo.');
    });

    it('REG-GET-ID-05 multi-tenancy: B lê id de regime de A', async () => {
        const regime = await criarRegimeConsumo(rebanho.id, insumo.id);
        const b = await criarUsuario();

        const r = await get(b, regime.id);
        expect(r.status).toBe(404);
        expect(r.body.message).toBe('Recurso não encontrado em Regime de Consumo.');
    });
});
