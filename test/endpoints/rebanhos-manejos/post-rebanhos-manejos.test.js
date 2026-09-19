import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import DbConnect from '../../../src/config/dbConnect.js';
import { api } from '../../apoio/cliente.js';
import { criarUsuario } from '../../apoio/auth.js';
import { criarPropriedade, criarPasto, criarRebanho, criarInsumo, criarTipoManejoRebanho } from '../../apoio/fabricas.js';
import { criarManejoRebanho } from './apoio-local.js';

describe('POST /v1/rebanhos/manejos', () => {
    let a, propriedade, pasto, rebanho, tipoManejo;

    beforeEach(async () => {
        a = await criarUsuario();
        propriedade = await criarPropriedade(a.id);
        pasto = await criarPasto(propriedade.id);
        rebanho = await criarRebanho(propriedade.id, pasto.id);
        tipoManejo = await criarTipoManejoRebanho();
    });

    const post = (usuario, corpo) =>
        api().post('/v1/rebanhos/manejos').set('Authorization', usuario.bearer).send(corpo);

    const corpoBase = (extra = {}) => ({
        rebanhoId: rebanho.id,
        tipoManejoId: tipoManejo.id,
        dataAtividade: '2026-01-01T00:00:00.000Z',
        ...extra,
    });

    it('MREB-POST-01 cria manejo sem itens', async () => {
        const r = await post(a, corpoBase());
        expect(r.status).toBe(201);
        expect(r.body.errors).toEqual([]);
        expect(r.body.data.id).toBeDefined();
        expect(r.body.data.itens).toEqual([]);
    });

    it('MREB-POST-02 aceita id gerado pelo cliente (offline-first)', async () => {
        const id = randomUUID();
        const r = await post(a, corpoBase({ id }));
        expect(r.status).toBe(201);
        expect(r.body.data.id).toBe(id);
    });

    it('MREB-POST-03 corpo vazio', async () => {
        const r = await post(a, {});
        expect(r.status).toBe(400);
        expect(r.body.errors[0].path).toBe('body');
    });

    it('MREB-POST-04 campo extra no corpo (.strict())', async () => {
        const r = await post(a, corpoBase({ extra: 1 }));
        expect(r.status).toBe(400);
        expect(r.body.tipo).toBe('validationError');
    });

    it('MREB-POST-05 falta rebanhoId', async () => {
        const { rebanhoId, ...corpo } = corpoBase();
        const r = await post(a, corpo);
        expect(r.status).toBe(400);
        expect(r.body.errors[0].path).toBe('rebanhoId');
    });

    it('MREB-POST-06 falta tipoManejoId', async () => {
        const { tipoManejoId, ...corpo } = corpoBase();
        const r = await post(a, corpo);
        expect(r.status).toBe(400);
        expect(r.body.errors[0].path).toBe('tipoManejoId');
    });

    it('MREB-POST-07 falta dataAtividade', async () => {
        const { dataAtividade, ...corpo } = corpoBase();
        const r = await post(a, corpo);
        expect(r.status).toBe(400);
        expect(r.body.errors[0].path).toBe('dataAtividade');
    });

    it('MREB-POST-08 dataAtividade no futuro', async () => {
        const r = await post(a, corpoBase({ dataAtividade: '2999-01-01T00:00:00.000Z' }));
        expect(r.status).toBe(400);
        expect(r.body.errors[0].message).toContain('não pode ser no futuro');
    });

    it('MREB-POST-09 pesoRegistrado zero ou negativo', async () => {
        const r = await post(a, corpoBase({ pesoRegistrado: 0 }));
        expect(r.status).toBe(400);
        expect(r.body.errors[0].path).toBe('pesoRegistrado');
    });

    it('MREB-POST-10 item com campo extra (.strict() do item)', async () => {
        const insumo = await criarInsumo(propriedade.id, { destino: 'Rebanho' });
        const r = await post(a, corpoBase({ itens: [{ insumoId: insumo.id, quantidade: 1, extra: 2 }] }));
        expect(r.status).toBe(400);
        expect(r.body.tipo).toBe('validationError');
    });

    it('MREB-POST-11 mais de 50 itens', async () => {
        const insumoId = randomUUID();
        const itens = Array.from({ length: 51 }, () => ({ insumoId, quantidade: 1 }));
        const r = await post(a, corpoBase({ itens }));
        expect(r.status).toBe(400);
        expect(r.body.errors[0].message).toBe('No máximo 50 itens de insumo por manejo.');
    });

    it('MREB-POST-12 sem token', async () => {
        const r = await api().post('/v1/rebanhos/manejos').send(corpoBase());
        expect(r.status).toBe(401);
        expect(r.body.tipo).toBe('unauthorized');
    });

    it('MREB-POST-13 admin (não dono) cria manejo em rebanho de A', async () => {
        const admin = await criarUsuario({ admin: true });
        const r = await post(admin, corpoBase());
        expect(r.status).toBe(404);
        expect(r.body.tipo).toBe('resourceNotFound');
    });

    it('MREB-POST-14 B tenta criar manejo com rebanhoId de A', async () => {
        const b = await criarUsuario();
        const r = await post(b, corpoBase());
        expect(r.status).toBe(404);
        expect(r.body.tipo).toBe('resourceNotFound');
    });

    it('MREB-POST-15 rebanhoId inexistente', async () => {
        const r = await post(a, corpoBase({ rebanhoId: randomUUID() }));
        expect(r.status).toBe(404);
        expect(r.body.tipo).toBe('resourceNotFound');
    });

    it('MREB-POST-16 rebanho inativo', async () => {
        const rebanhoInativo = await criarRebanho(propriedade.id, pasto.id, { ativo: false });
        const r = await post(a, corpoBase({ rebanhoId: rebanhoInativo.id }));
        expect(r.status).toBe(400);
        expect(r.body.errors[0].path).toBe('rebanhoId');
        expect(r.body.errors[0].message).toContain('rebanho inativo');
    });

    it('MREB-POST-17 tipoManejoId inexistente ou inativo', async () => {
        const r = await post(a, corpoBase({ tipoManejoId: randomUUID() }));
        expect(r.status).toBe(404);
        expect(r.body.tipo).toBe('resourceNotFound');
        expect(r.body.errors[0].path).toBe('tipoManejoId');
    });

    it('MREB-POST-18 item com insumoId inexistente/de outra propriedade', async () => {
        const outraPropriedade = await criarPropriedade(a.id);
        const insumoDeOutraPropriedade = await criarInsumo(outraPropriedade.id, { destino: 'Rebanho' });
        const r = await post(a, corpoBase({ itens: [{ insumoId: insumoDeOutraPropriedade.id, quantidade: 1 }] }));
        expect(r.status).toBe(400);
        expect(r.body.errors[0].path).toBe('itens');
    });

    it('MREB-POST-19 item com insumo de destino "Pasto" (incompatível com rebanho)', async () => {
        const insumo = await criarInsumo(propriedade.id, { destino: 'Pasto' });
        const r = await post(a, corpoBase({ itens: [{ insumoId: insumo.id, quantidade: 1 }] }));
        expect(r.status).toBe(400);
        expect(r.body.errors[0].path).toBe('itens');
        expect(r.body.errors[0].message).toContain('não é destinado ao rebanho');
    });

    it('MREB-POST-20 item válido cria movimentação de insumo Saida', async () => {
        const insumo = await criarInsumo(propriedade.id, { destino: 'Rebanho' });
        const r = await post(a, corpoBase({ itens: [{ insumoId: insumo.id, quantidade: 10 }] }));
        expect(r.status).toBe(201);
        expect(r.body.data.itens[0]).toBeDefined();

        const mov = await DbConnect.prisma.movimentacaoInsumo.findFirst({
            where: { manejoRebanhoId: r.body.data.id },
        });
        expect(mov).toMatchObject({
            tipo: 'Saida',
            origem: 'ManejoRebanho',
            manejoRebanhoId: r.body.data.id,
            rebanhoId: rebanho.id,
        });
    });

    it('MREB-POST-21 item preserva id enviado pelo cliente (offline-first)', async () => {
        const insumo = await criarInsumo(propriedade.id, { destino: 'Rebanho' });
        const itemId = randomUUID();
        const r = await post(a, corpoBase({ itens: [{ id: itemId, insumoId: insumo.id, quantidade: 3 }] }));
        expect(r.status).toBe(201);

        const mov = await DbConnect.prisma.movimentacaoInsumo.findUnique({ where: { id: itemId } });
        expect(mov).not.toBeNull();
        expect(mov.manejoRebanhoId).toBe(r.body.data.id);
    });

    it('MREB-POST-22 item sem id', async () => {
        const insumo = await criarInsumo(propriedade.id, { destino: 'Rebanho' });
        const r = await post(a, corpoBase({ itens: [{ insumoId: insumo.id, quantidade: 3 }] }));
        expect(r.status).toBe(201);

        const mov = await DbConnect.prisma.movimentacaoInsumo.findFirst({
            where: { manejoRebanhoId: r.body.data.id },
        });
        expect(mov).not.toBeNull();
        expect(mov.id).toBeDefined();
    });

    it('MREB-POST-23 saída deixaria o saldo do insumo negativo', async () => {
        const insumo = await criarInsumo(propriedade.id, { destino: 'Rebanho' });
        const r = await post(a, corpoBase({ itens: [{ insumoId: insumo.id, quantidade: 5 }] }));
        expect(r.status).toBe(201);
        expect(r.body.data.avisos).toBeDefined();
        expect(r.body.data.avisos[0]).toContain('Estoque insuficiente');

        const mov = await DbConnect.prisma.movimentacaoInsumo.findFirst({
            where: { manejoRebanhoId: r.body.data.id },
        });
        expect(mov).not.toBeNull();
    });

    it('MREB-POST-24 pesoRegistrado é a pesagem mais recente do rebanho', async () => {
        const r = await post(a, corpoBase({ pesoRegistrado: 450 }));
        expect(r.status).toBe(201);

        const getR = await api().get(`/v1/rebanhos/${rebanho.id}`).set('Authorization', a.bearer);
        expect(Number(getR.body.data.pesoMedioAtual)).toBe(450);
    });

    it('MREB-POST-25 pesoRegistrado, mas já existe pesagem mais recente', async () => {
        await DbConnect.prisma.rebanho.update({ where: { id: rebanho.id }, data: { pesoMedioAtual: 500 } });
        await criarManejoRebanho(rebanho.id, tipoManejo.id, { dataAtividade: new Date(), pesoRegistrado: 500 });

        const dataAntiga = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const r = await post(a, corpoBase({ dataAtividade: dataAntiga, pesoRegistrado: 400 }));
        expect(r.status).toBe(201);

        const rebanhoAtual = await DbConnect.prisma.rebanho.findUnique({ where: { id: rebanho.id } });
        expect(Number(rebanhoAtual.pesoMedioAtual)).toBe(500);
    });

    it('MREB-POST-26 item inválido no meio da criação não persiste nada', async () => {
        const insumoValido = await criarInsumo(propriedade.id, { destino: 'Rebanho' });
        const insumoIncompativel = await criarInsumo(propriedade.id, { destino: 'Pasto' });
        const r = await post(a, corpoBase({
            itens: [
                { insumoId: insumoValido.id, quantidade: 1 },
                { insumoId: insumoIncompativel.id, quantidade: 1 },
            ],
        }));
        expect(r.status).toBe(400);

        const lista = await api().get('/v1/rebanhos/manejos').set('Authorization', a.bearer);
        expect(lista.body.data.docs).toEqual([]);
    });
});
