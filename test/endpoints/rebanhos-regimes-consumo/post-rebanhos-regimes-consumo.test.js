import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import DbConnect from '../../../src/config/dbConnect.js';
import { api } from '../../apoio/cliente.js';
import { criarUsuario } from '../../apoio/auth.js';
import { criarPropriedade, criarPasto, criarRebanho, criarInsumo } from '../../apoio/fabricas.js';
import { criarRegimeConsumo } from './apoio-local.js';

describe('POST /v1/rebanhos/regimes-consumo', () => {
    let a, propriedade, pasto, rebanho, insumo;

    beforeEach(async () => {
        a = await criarUsuario();
        propriedade = await criarPropriedade(a.id);
        pasto = await criarPasto(propriedade.id);
        rebanho = await criarRebanho(propriedade.id, pasto.id);
        insumo = await criarInsumo(propriedade.id, { destino: 'Ambos' });
    });

    const post = (usuario, corpo) =>
        api().post('/v1/rebanhos/regimes-consumo').set('Authorization', usuario.bearer).send(corpo);

    const corpoBase = (extra = {}) => ({
        rebanhoId: rebanho.id,
        insumoId: insumo.id,
        quantidadeDia: 3.5,
        dataInicio: '2026-01-01T00:00:00.000Z',
        ...extra,
    });

    it('REG-POST-01 cria regime válido (sem dataFim)', async () => {
        const r = await post(a, corpoBase());
        expect(r.status).toBe(201);
        expect(r.body.errors).toEqual([]);
        expect(r.body.data.id).toBeDefined();
        expect(r.body.data.ativo).toBe(true);
        expect(r.body.data.dataFim).toBeNull();
        expect(r.body.data.insumo).toMatchObject({ id: insumo.id, nome: insumo.nome, unidadeMedida: insumo.unidadeMedida });
        expect(r.body.data.rebanho).toMatchObject({ id: rebanho.id, nomeRebanho: rebanho.nomeRebanho });
    });

    it('REG-POST-02 aceita id gerado pelo cliente (offline-first)', async () => {
        const id = randomUUID();
        const r = await post(a, corpoBase({ id }));
        expect(r.status).toBe(201);
        expect(r.body.data.id).toBe(id);
    });

    it('REG-POST-03 aceita dataFim informada (dataInicio <= dataFim)', async () => {
        const r = await post(a, corpoBase({ dataFim: '2026-02-01T00:00:00.000Z' }));
        expect(r.status).toBe(201);
        expect(new Date(r.body.data.dataFim).toISOString()).toBe('2026-02-01T00:00:00.000Z');
    });

    it('REG-POST-04 corpo vazio', async () => {
        const r = await post(a, {});
        expect(r.status).toBe(400);
        expect(r.body.message).toBe('Forneça os dados do regime de consumo.');
    });

    it('REG-POST-05 campo extra no corpo (.strict())', async () => {
        const r = await post(a, corpoBase({ extra: 1 }));
        expect(r.status).toBe(400);
        expect(r.body.tipo).toBe('validationError');
    });

    it('REG-POST-06 rebanhoId ausente', async () => {
        const { rebanhoId, ...corpo } = corpoBase();
        const r = await post(a, corpo);
        expect(r.status).toBe(400);
        expect(r.body.tipo).toBe('validationError');
        expect(r.body.errors[0].path).toBe('rebanhoId');
    });

    it('REG-POST-07 insumoId ausente', async () => {
        const { insumoId, ...corpo } = corpoBase();
        const r = await post(a, corpo);
        expect(r.status).toBe(400);
        expect(r.body.tipo).toBe('validationError');
        expect(r.body.errors[0].path).toBe('insumoId');
    });

    it('REG-POST-08 quantidadeDia ausente', async () => {
        const { quantidadeDia, ...corpo } = corpoBase();
        const r = await post(a, corpo);
        expect(r.status).toBe(400);
        expect(r.body.tipo).toBe('validationError');
        expect(r.body.errors[0].path).toBe('quantidadeDia');
    });

    it('REG-POST-09 dataInicio ausente', async () => {
        const { dataInicio, ...corpo } = corpoBase();
        const r = await post(a, corpo);
        expect(r.status).toBe(400);
        expect(r.body.tipo).toBe('validationError');
        expect(r.body.errors[0].path).toBe('dataInicio');
    });

    it('REG-POST-10 quantidadeDia <= 0', async () => {
        const r = await post(a, corpoBase({ quantidadeDia: 0 }));
        expect(r.status).toBe(400);
        expect(r.body.errors[0].message).toBe('A quantidade diária deve ser maior que zero.');
    });

    it('REG-POST-11 dataInicio depois de dataFim', async () => {
        const r = await post(a, corpoBase({ dataInicio: '2026-03-01T00:00:00.000Z', dataFim: '2026-02-01T00:00:00.000Z' }));
        expect(r.status).toBe(400);
        expect(r.body.errors[0].message).toBe('A data de início não pode ser depois da data de fim.');
        expect(r.body.errors[0].path).toBe('dataFim');
    });

    it('REG-POST-12 rebanhoId não é UUID', async () => {
        const r = await post(a, corpoBase({ rebanhoId: 'nao-uuid' }));
        expect(r.status).toBe(400);
        expect(r.body.tipo).toBe('validationError');
    });

    it('REG-POST-13 id (cliente) não é UUID', async () => {
        const r = await post(a, corpoBase({ id: 'nao-uuid' }));
        expect(r.status).toBe(400);
        expect(r.body.tipo).toBe('validationError');
    });

    it('REG-POST-14 sem token', async () => {
        const r = await api().post('/v1/rebanhos/regimes-consumo').send(corpoBase());
        expect(r.status).toBe(401);
        expect(r.body.tipo).toBe('unauthorized');
    });

    it('REG-POST-15 rebanhoId inexistente', async () => {
        const r = await post(a, corpoBase({ rebanhoId: randomUUID() }));
        expect(r.status).toBe(404);
        expect(r.body.message).toBe('Rebanho não encontrado ou não pertence ao usuário autenticado.');
    });

    it('REG-POST-16 rebanhoId de A, logado como B', async () => {
        const b = await criarUsuario();
        const r = await post(b, corpoBase());
        expect(r.status).toBe(404);
        expect(r.body.message).toBe('Rebanho não encontrado ou não pertence ao usuário autenticado.');
    });

    it('REG-POST-17 insumoId inexistente', async () => {
        const r = await post(a, corpoBase({ insumoId: randomUUID() }));
        expect(r.status).toBe(404);
        expect(r.body.message).toBe('Insumo não encontrado ou não pertence ao usuário autenticado.');
    });

    it('REG-POST-18 insumoId de A, logado como B (rebanho de B)', async () => {
        const b = await criarUsuario();
        const propriedadeB = await criarPropriedade(b.id);
        const pastoB = await criarPasto(propriedadeB.id);
        const rebanhoB = await criarRebanho(propriedadeB.id, pastoB.id);
        const r = await post(b, corpoBase({ rebanhoId: rebanhoB.id, insumoId: insumo.id }));
        expect(r.status).toBe(404);
        expect(r.body.message).toBe('Insumo não encontrado ou não pertence ao usuário autenticado.');
    });

    it('REG-POST-19 insumo de propriedade diferente da do rebanho', async () => {
        const outraPropriedade = await criarPropriedade(a.id);
        const insumoOutraPropriedade = await criarInsumo(outraPropriedade.id, { destino: 'Ambos' });
        const r = await post(a, corpoBase({ insumoId: insumoOutraPropriedade.id }));
        expect(r.status).toBe(400);
        expect(r.body.tipo).toBe('validationError');
        expect(r.body.message).toBe('Insumo e rebanho são de propriedades diferentes.');
        expect(r.body.errors[0].path).toBe('insumoId');
    });

    it('REG-POST-20 insumo com destino = Pasto (incompatível com rebanho)', async () => {
        const insumoPasto = await criarInsumo(propriedade.id, { destino: 'Pasto' });
        const r = await post(a, corpoBase({ insumoId: insumoPasto.id }));
        expect(r.status).toBe(400);
        expect(r.body.message).toBe('Insumo não pode ser consumido pelo rebanho.');
        expect(r.body.errors[0].path).toBe('insumoId');
    });

    it('REG-POST-21 par (rebanhoId, insumoId) já tem um regime em aberto', async () => {
        const anterior = await criarRegimeConsumo(rebanho.id, insumo.id, { dataInicio: new Date('2026-01-01T00:00:00.000Z') });

        const r = await post(a, corpoBase({ dataInicio: '2026-03-01T00:00:00.000Z' }));
        expect(r.status).toBe(201);
        expect(r.body.data.id).not.toBe(anterior.id);

        const anteriorAtualizado = await DbConnect.prisma.regimeConsumoInsumo.findUnique({ where: { id: anterior.id } });
        expect(anteriorAtualizado.ativo).toBe(false);
        expect(anteriorAtualizado.dataFim.toISOString()).toBe('2026-03-01T00:00:00.000Z');
    });
});
