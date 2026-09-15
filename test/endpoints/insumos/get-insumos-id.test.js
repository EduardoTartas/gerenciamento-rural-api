import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { api } from '../../apoio/cliente.js';
import { criarUsuario } from '../../apoio/auth.js';
import { criarPropriedade, criarPasto, criarRebanho, criarTipoInsumo, criarInsumo } from '../../apoio/fabricas.js';
import { criarMovimentacaoInsumo, criarRegimeConsumoInsumo } from './apoio-local.js';

describe('GET /v1/insumos/:id', () => {
    let a;
    let propriedade;
    let tipoInsumo;

    beforeEach(async () => {
        a = await criarUsuario();
        propriedade = await criarPropriedade(a.id);
        tipoInsumo = await criarTipoInsumo();
    });

    const get = (usuario, id) =>
        api().get(`/v1/insumos/${id}`).set('Authorization', usuario.bearer);

    const criarRebanhoDeA = async () => {
        const pasto = await criarPasto(propriedade.id);
        return criarRebanho(propriedade.id, pasto.id);
    };

    it('INS-GET-ID-01 detalha com saldo calculado do ledger cru', async () => {
        const insumo = await criarInsumo(propriedade.id, { tipoInsumoId: tipoInsumo.id });
        await criarMovimentacaoInsumo(insumo.id, { tipo: 'Entrada', quantidade: 100 });
        const rebanho = await criarRebanhoDeA();
        await criarRegimeConsumoInsumo(rebanho.id, insumo.id, { quantidadeDia: 5, dataInicio: new Date('2026-01-01T00:00:00Z') });

        const r = await get(a, insumo.id);
        expect(r.status).toBe(200);
        expect(r.body.message).toBe('Insumo encontrado com sucesso.');
        const { saldo } = r.body.data;
        for (const chave of ['saldoReal', 'consumoProjetado', 'saldoProjetado', 'consumoDiaTotal', 'diasRestantes', 'previsaoTermino', 'esgotado', 'estoqueBaixo']) {
            expect(saldo).toHaveProperty(chave);
        }
    });

    it('INS-GET-ID-02 saldo esgotado (saldoProjetado <= 0)', async () => {
        const insumo = await criarInsumo(propriedade.id, { tipoInsumoId: tipoInsumo.id });
        await criarMovimentacaoInsumo(insumo.id, { tipo: 'Entrada', quantidade: 5 });
        const rebanho = await criarRebanhoDeA();
        await criarRegimeConsumoInsumo(rebanho.id, insumo.id, { quantidadeDia: 10, dataInicio: new Date('2026-01-01T00:00:00Z') });

        const r = await get(a, insumo.id);
        expect(r.status).toBe(200);
        expect(r.body.data.saldo.esgotado).toBe(true);
        expect(r.body.data.saldo.previsaoTermino).toBeNull();
    });

    it('INS-GET-ID-03 insumo sem regimes de consumo', async () => {
        const insumo = await criarInsumo(propriedade.id, { tipoInsumoId: tipoInsumo.id });
        await criarMovimentacaoInsumo(insumo.id, { tipo: 'Entrada', quantidade: 40 });

        const r = await get(a, insumo.id);
        expect(r.status).toBe(200);
        expect(r.body.data.saldo.saldoProjetado).toBe(r.body.data.saldo.saldoReal);
        expect(r.body.data.saldo.consumoDiaTotal).toBe(0);
        expect(r.body.data.saldo.diasRestantes).toBeNull();
    });

    it('INS-GET-ID-04 regime encerrado soma no consumoProjetado, mas não no consumoDiaTotal', async () => {
        const insumo = await criarInsumo(propriedade.id, { tipoInsumoId: tipoInsumo.id });
        await criarMovimentacaoInsumo(insumo.id, { tipo: 'Entrada', quantidade: 500 });
        const rebanho = await criarRebanhoDeA();
        await criarRegimeConsumoInsumo(rebanho.id, insumo.id, {
            quantidadeDia: 2, ativo: false,
            dataInicio: new Date('2026-01-01T00:00:00Z'), dataFim: new Date('2026-01-11T00:00:00Z'),
        });
        await criarRegimeConsumoInsumo(rebanho.id, insumo.id, {
            quantidadeDia: 3, ativo: true,
            dataInicio: new Date('2026-01-01T00:00:00Z'), dataFim: null,
        });

        const r = await get(a, insumo.id);
        expect(r.status).toBe(200);
        // taxa diária conta só o regime aberto (3/dia)
        expect(r.body.data.saldo.consumoDiaTotal).toBe(3);
        // o regime encerrado contribuiu com seus 10 dias * 2/dia = 20 para a projeção
        expect(r.body.data.saldo.consumoProjetado).toBeGreaterThanOrEqual(20);
    });

    it('INS-GET-ID-05 id não é UUID', async () => {
        const r = await get(a, 'nao-e-uuid');
        expect(r.status).toBe(400);
        expect(r.body.tipo).toBe('validationError');
    });

    it('INS-GET-ID-06 sem token', async () => {
        const insumo = await criarInsumo(propriedade.id, { tipoInsumoId: tipoInsumo.id });
        const r = await api().get(`/v1/insumos/${insumo.id}`);
        expect(r.status).toBe(401);
        expect(r.body.tipo).toBe('unauthorized');
    });

    it('INS-GET-ID-07 id inexistente', async () => {
        const r = await get(a, randomUUID());
        expect(r.status).toBe(404);
        expect(r.body.message).toBe('Recurso não encontrado em Insumo.');
    });

    it('INS-GET-ID-08 multi-tenancy: B lê id de um insumo de A', async () => {
        const insumo = await criarInsumo(propriedade.id, { tipoInsumoId: tipoInsumo.id });
        const b = await criarUsuario();

        const r = await get(b, insumo.id);
        expect(r.status).toBe(404);
        expect(r.body.message).toBe('Recurso não encontrado em Insumo.');
    });
});
