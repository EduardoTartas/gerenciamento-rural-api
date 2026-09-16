import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import DbConnect from '../../../src/config/dbConnect.js';
import { api } from '../../apoio/cliente.js';
import { criarUsuario } from '../../apoio/auth.js';
import { criarPropriedade, criarPasto, criarRebanho, criarInsumo } from '../../apoio/fabricas.js';
import { criarRegimeConsumo } from './apoio-local.js';

describe('PATCH /v1/rebanhos/regimes-consumo/:id', () => {
    let a, propriedade, pasto, rebanho, insumo;

    beforeEach(async () => {
        a = await criarUsuario();
        propriedade = await criarPropriedade(a.id);
        pasto = await criarPasto(propriedade.id);
        rebanho = await criarRebanho(propriedade.id, pasto.id);
        insumo = await criarInsumo(propriedade.id, { destino: 'Ambos' });
    });

    const patch = (usuario, id, corpo) =>
        api().patch(`/v1/rebanhos/regimes-consumo/${id}`).set('Authorization', usuario.bearer).send(corpo);

    it('REG-PATCH-ID-01 atualiza quantidadeDia', async () => {
        const regime = await criarRegimeConsumo(rebanho.id, insumo.id, { quantidadeDia: 3 });

        const r = await patch(a, regime.id, { quantidadeDia: 8 });
        expect(r.status).toBe(200);
        expect(Number(r.body.data.quantidadeDia)).toBe(8);
    });

    it('REG-PATCH-ID-02 define dataFim (encerra o regime)', async () => {
        const regime = await criarRegimeConsumo(rebanho.id, insumo.id);

        const r = await patch(a, regime.id, { dataFim: '2026-02-01T00:00:00.000Z' });
        expect(r.status).toBe(200);
        expect(r.body.data.ativo).toBe(false);

        const salvo = await DbConnect.prisma.regimeConsumoInsumo.findUnique({ where: { id: regime.id } });
        expect(salvo.ativo).toBe(false);
    });

    it('REG-PATCH-ID-03 reabre com dataFim: null', async () => {
        const encerrado = await criarRegimeConsumo(rebanho.id, insumo.id, {
            dataInicio: new Date('2026-01-01T00:00:00Z'),
            dataFim: new Date('2026-01-15T00:00:00Z'),
            ativo: false,
        });
        const outroAberto = await criarRegimeConsumo(rebanho.id, insumo.id, { dataInicio: new Date('2026-01-16T00:00:00Z') });

        const r = await patch(a, encerrado.id, { dataFim: null });
        expect(r.status).toBe(200);
        expect(r.body.data.ativo).toBe(true);
        expect(r.body.data.dataFim).toBeNull();

        const outroAtualizado = await DbConnect.prisma.regimeConsumoInsumo.findUnique({ where: { id: outroAberto.id } });
        expect(outroAtualizado.ativo).toBe(false);
    });

    it('REG-PATCH-ID-04 corpo vazio', async () => {
        const regime = await criarRegimeConsumo(rebanho.id, insumo.id);
        const r = await patch(a, regime.id, {});
        expect(r.status).toBe(400);
        expect(r.body.message).toBe('Forneça pelo menos um campo para atualizar.');
    });

    it('REG-PATCH-ID-05 campo extra no corpo (.strict())', async () => {
        const regime = await criarRegimeConsumo(rebanho.id, insumo.id);
        const r = await patch(a, regime.id, { quantidadeDia: 5, extra: 1 });
        expect(r.status).toBe(400);
        expect(r.body.tipo).toBe('validationError');
    });

    it('REG-PATCH-ID-06 quantidadeDia <= 0', async () => {
        const regime = await criarRegimeConsumo(rebanho.id, insumo.id);
        const r = await patch(a, regime.id, { quantidadeDia: 0 });
        expect(r.status).toBe(400);
        expect(r.body.errors[0].message).toBe('A quantidade diária deve ser maior que zero.');
    });

    it('REG-PATCH-ID-07 dataFim inválida (não é data)', async () => {
        const regime = await criarRegimeConsumo(rebanho.id, insumo.id);
        const r = await patch(a, regime.id, { dataFim: 'nao-e-data' });
        expect(r.status).toBe(400);
        expect(r.body.tipo).toBe('validationError');
    });

    it('REG-PATCH-ID-08 id não é UUID', async () => {
        const r = await patch(a, 'nao-uuid', { quantidadeDia: 5 });
        expect(r.status).toBe(400);
        expect(r.body.tipo).toBe('validationError');
    });

    it('REG-PATCH-ID-09 sem token', async () => {
        const regime = await criarRegimeConsumo(rebanho.id, insumo.id);
        const r = await api().patch(`/v1/rebanhos/regimes-consumo/${regime.id}`).send({ quantidadeDia: 5 });
        expect(r.status).toBe(401);
        expect(r.body.tipo).toBe('unauthorized');
    });

    it('REG-PATCH-ID-10 id inexistente', async () => {
        const r = await patch(a, randomUUID(), { quantidadeDia: 5 });
        expect(r.status).toBe(404);
        expect(r.body.message).toBe('Recurso não encontrado em Regime de Consumo.');
    });

    it('REG-PATCH-ID-11 multi-tenancy: B atualiza id de regime de A', async () => {
        const regime = await criarRegimeConsumo(rebanho.id, insumo.id);
        const b = await criarUsuario();

        const r = await patch(b, regime.id, { quantidadeDia: 9 });
        expect(r.status).toBe(404);
        expect(r.body.message).toBe('Recurso não encontrado em Regime de Consumo.');

        const salvo = await DbConnect.prisma.regimeConsumoInsumo.findUnique({ where: { id: regime.id } });
        expect(Number(salvo.quantidadeDia)).toBe(Number(regime.quantidadeDia));
    });
});
