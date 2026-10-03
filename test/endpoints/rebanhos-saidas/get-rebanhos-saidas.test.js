import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { api } from '../../apoio/cliente.js';
import { criarUsuario } from '../../apoio/auth.js';
import { criarPropriedade, criarPasto, criarRebanho } from '../../apoio/fabricas.js';
import { registrarSaida } from './apoio-local.js';

describe('GET /v1/rebanhos/saidas', () => {
    let a, propriedadeA, pastoA, rebanhoA;

    beforeEach(async () => {
        a = await criarUsuario();
        propriedadeA = await criarPropriedade(a.id);
        pastoA = await criarPasto(propriedadeA.id, { status: 'Ocupado' });
        rebanhoA = await criarRebanho(propriedadeA.id, pastoA.id, { quantidadeCabecas: 100 });
    });

    const get = (usuario, query = '') =>
        api().get(`/v1/rebanhos/saidas${query}`).set('Authorization', usuario.bearer);

    const saida = (extra = {}) =>
        registrarSaida(a, { rebanhoId: rebanhoA.id, motivo: 'Venda', quantidadeCabecas: 5, ...extra });

    it('SAI-GET-01 lista as saídas de A com o rebanho', async () => {
        await saida();
        await saida({ motivo: 'Morte', quantidadeCabecas: 1 });

        const r = await get(a);
        expect(r.status).toBe(200);
        expect(r.body.message).toBe('2 saída(s) encontrada(s).');
        expect(r.body.data.docs).toHaveLength(2);
        expect(r.body.data.docs.every((s) => s.rebanho.id === rebanhoA.id)).toBe(true);
        expect(r.body.data.docs[0]).toHaveProperty('updatedAt');
        expect(r.body.data.docs[0]).toHaveProperty('ativo', true);
    });

    it('SAI-GET-02 usuário sem saídas', async () => {
        const r = await get(a);
        expect(r.status).toBe(200);
        expect(r.body.message).toBe('Nenhuma saída registrada.');
        expect(r.body.data.docs).toEqual([]);
    });

    it('SAI-GET-03 filtro sem resultado', async () => {
        const r = await get(a, `?rebanhoId=${randomUUID()}`);
        expect(r.status).toBe(200);
        expect(r.body.message).toBe('Nenhuma saída encontrada com os filtros informados.');
    });

    it('SAI-GET-04 ordena por dataSaida decrescente', async () => {
        const s1 = await saida({ dataSaida: '2026-01-10T00:00:00.000Z' });
        const s2 = await saida({ dataSaida: '2026-01-05T00:00:00.000Z' });
        const s3 = await saida({ dataSaida: '2026-01-15T00:00:00.000Z' });

        const r = await get(a);
        expect(r.body.data.docs.map((s) => s.id)).toEqual([s3.id, s1.id, s2.id]);
    });

    it('SAI-GET-05 filtro rebanhoId', async () => {
        const outro = await criarRebanho(propriedadeA.id, pastoA.id, { quantidadeCabecas: 10 });
        await saida();
        await registrarSaida(a, { rebanhoId: outro.id, motivo: 'Venda', quantidadeCabecas: 1 });

        const r = await get(a, `?rebanhoId=${rebanhoA.id}`);
        expect(r.body.data.docs).toHaveLength(1);
        expect(r.body.data.docs[0].rebanhoId).toBe(rebanhoA.id);
    });

    it('SAI-GET-06 filtro propriedadeId', async () => {
        const outraPropriedade = await criarPropriedade(a.id);
        const outroPasto = await criarPasto(outraPropriedade.id);
        const outroRebanho = await criarRebanho(outraPropriedade.id, outroPasto.id, { quantidadeCabecas: 10 });
        await saida();
        await registrarSaida(a, { rebanhoId: outroRebanho.id, motivo: 'Abate', quantidadeCabecas: 2 });

        const r = await get(a, `?propriedadeId=${outraPropriedade.id}`);
        expect(r.body.data.docs).toHaveLength(1);
        expect(r.body.data.docs[0].rebanho.propriedade.id).toBe(outraPropriedade.id);
    });

    it('SAI-GET-07 filtro motivo', async () => {
        await saida();
        await saida({ motivo: 'Morte', quantidadeCabecas: 1 });

        const r = await get(a, '?motivo=Morte');
        expect(r.body.data.docs).toHaveLength(1);
        expect(r.body.data.docs[0].motivo).toBe('Morte');
    });

    it('SAI-GET-08 filtro motivo inválido', async () => {
        const r = await get(a, '?motivo=Doacao');
        expect(r.status).toBe(400);
        expect(r.body.tipo).toBe('validationError');
    });

    it('SAI-GET-09 filtro dataInicio/dataFim', async () => {
        await saida({ dataSaida: '2026-01-05T00:00:00.000Z' });
        const dentro = await saida({ dataSaida: '2026-02-10T00:00:00.000Z' });
        await saida({ dataSaida: '2026-03-20T00:00:00.000Z' });

        const r = await get(a, '?dataInicio=2026-02-01T00:00:00.000Z&dataFim=2026-02-28T00:00:00.000Z');
        expect(r.body.data.docs.map((s) => s.id)).toEqual([dentro.id]);
    });

    it('SAI-GET-10 atualizadoDesde devolve só o que mudou depois da marca', async () => {
        await saida();
        const marca = new Date().toISOString();
        await new Promise((resolve) => setTimeout(resolve, 5));
        const nova = await saida({ motivo: 'Outro', quantidadeCabecas: 2 });

        const r = await get(a, `?atualizadoDesde=${marca}`);
        expect(r.body.data.docs.map((s) => s.id)).toEqual([nova.id]);
    });

    it('SAI-GET-11 parâmetro desconhecido (.strict())', async () => {
        const r = await get(a, '?valor=10');
        expect(r.status).toBe(400);
        expect(r.body.tipo).toBe('validationError');
    });

    it('SAI-GET-12 B não vê as saídas de A', async () => {
        await saida();
        const b = await criarUsuario();
        const r = await get(b);
        expect(r.body.data.docs).toEqual([]);
    });

    it('SAI-GET-13 sem token', async () => {
        const r = await api().get('/v1/rebanhos/saidas');
        expect(r.status).toBe(401);
    });
});

describe('GET /v1/rebanhos/saidas/:id', () => {
    let a, saidaA;

    beforeEach(async () => {
        a = await criarUsuario();
        const propriedade = await criarPropriedade(a.id);
        const pasto = await criarPasto(propriedade.id, { status: 'Ocupado' });
        const rebanho = await criarRebanho(propriedade.id, pasto.id, { quantidadeCabecas: 10 });
        saidaA = await registrarSaida(a, { rebanhoId: rebanho.id, motivo: 'Venda', quantidadeCabecas: 4 });
    });

    const get = (usuario, id) =>
        api().get(`/v1/rebanhos/saidas/${id}`).set('Authorization', usuario.bearer);

    it('SAI-GET-ID-01 busca saída de A', async () => {
        const r = await get(a, saidaA.id);
        expect(r.status).toBe(200);
        expect(r.body.data.id).toBe(saidaA.id);
        expect(r.body.data.quantidadeCabecas).toBe(4);
        expect(r.body.data.rebanho.quantidadeCabecas).toBe(6);
    });

    it('SAI-GET-ID-02 id não é UUID', async () => {
        const r = await get(a, 'nao-e-uuid');
        expect(r.status).toBe(400);
        expect(r.body.tipo).toBe('validationError');
    });

    it('SAI-GET-ID-03 id inexistente', async () => {
        const r = await get(a, randomUUID());
        expect(r.status).toBe(404);
        expect(r.body.tipo).toBe('resourceNotFound');
    });

    it('SAI-GET-ID-04 B busca saída de A', async () => {
        const b = await criarUsuario();
        const r = await get(b, saidaA.id);
        expect(r.status).toBe(404);
    });
});
