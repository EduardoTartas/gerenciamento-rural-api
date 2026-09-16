import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import DbConnect from '../../../src/config/dbConnect.js';
import { api } from '../../apoio/cliente.js';
import { criarUsuario } from '../../apoio/auth.js';
import { criarPropriedade, criarPasto, criarRebanho, criarInsumo } from '../../apoio/fabricas.js';
import { criarRegimeConsumo } from './apoio-local.js';

describe('DELETE /v1/rebanhos/regimes-consumo/:id', () => {
    let a, propriedade, pasto, rebanho, insumo;

    beforeEach(async () => {
        a = await criarUsuario();
        propriedade = await criarPropriedade(a.id);
        pasto = await criarPasto(propriedade.id);
        rebanho = await criarRebanho(propriedade.id, pasto.id);
        insumo = await criarInsumo(propriedade.id, { destino: 'Ambos' });
    });

    const del = (usuario, id) =>
        api().delete(`/v1/rebanhos/regimes-consumo/${id}`).set('Authorization', usuario.bearer);

    it('REG-DELETE-ID-01 encerra o regime (soft-delete lógico)', async () => {
        const regime = await criarRegimeConsumo(rebanho.id, insumo.id, { dataInicio: new Date('2026-01-01T00:00:00Z') });

        const r = await del(a, regime.id);
        expect(r.status).toBe(200);
        expect(r.body.message).toBe('Regime de consumo encerrado com sucesso.');

        const salvo = await DbConnect.prisma.regimeConsumoInsumo.findUnique({ where: { id: regime.id } });
        expect(salvo.ativo).toBe(false);
        expect(salvo.dataFim).not.toBeNull();
    });

    it('REG-DELETE-ID-02 regime com dataInicio no futuro excluído hoje: dataFim = dataInicio', async () => {
        const dataFutura = new Date(Date.now() + 24 * 60 * 60 * 1000);
        const regime = await criarRegimeConsumo(rebanho.id, insumo.id, { dataInicio: dataFutura });

        const r = await del(a, regime.id);
        expect(r.status).toBe(200);

        const salvo = await DbConnect.prisma.regimeConsumoInsumo.findUnique({ where: { id: regime.id } });
        expect(salvo.dataFim.toISOString()).toBe(dataFutura.toISOString());
    });

    it('REG-DELETE-ID-03 id não é UUID', async () => {
        const r = await del(a, 'nao-uuid');
        expect(r.status).toBe(400);
        expect(r.body.tipo).toBe('validationError');
    });

    it('REG-DELETE-ID-04 sem token', async () => {
        const regime = await criarRegimeConsumo(rebanho.id, insumo.id);
        const r = await api().delete(`/v1/rebanhos/regimes-consumo/${regime.id}`);
        expect(r.status).toBe(401);
        expect(r.body.tipo).toBe('unauthorized');
    });

    it('REG-DELETE-ID-05 id inexistente', async () => {
        const r = await del(a, randomUUID());
        expect(r.status).toBe(404);
        expect(r.body.message).toBe('Recurso não encontrado em Regime de Consumo.');
    });

    it('REG-DELETE-ID-06 multi-tenancy: B exclui id de regime de A', async () => {
        const regime = await criarRegimeConsumo(rebanho.id, insumo.id);
        const b = await criarUsuario();

        const r = await del(b, regime.id);
        expect(r.status).toBe(404);
        expect(r.body.message).toBe('Recurso não encontrado em Regime de Consumo.');

        const salvo = await DbConnect.prisma.regimeConsumoInsumo.findUnique({ where: { id: regime.id } });
        expect(salvo.ativo).toBe(true);
    });
});
