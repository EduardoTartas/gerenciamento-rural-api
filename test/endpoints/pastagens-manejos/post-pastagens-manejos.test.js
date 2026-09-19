import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import DbConnect from '../../../src/config/dbConnect.js';
import { api } from '../../apoio/cliente.js';
import { criarUsuario } from '../../apoio/auth.js';
import { criarPropriedade, criarPasto, criarInsumo, criarTipoManejoPasto } from '../../apoio/fabricas.js';

describe('POST /v1/pastagens/manejos', () => {
    let a, propriedade, pasto, tipoManejo;

    beforeEach(async () => {
        a = await criarUsuario();
        propriedade = await criarPropriedade(a.id);
        pasto = await criarPasto(propriedade.id);
        tipoManejo = await criarTipoManejoPasto();
    });

    const post = (usuario, corpo) =>
        api().post('/v1/pastagens/manejos').set('Authorization', usuario.bearer).send(corpo);

    const corpoBase = (extra = {}) => ({
        pastoId: pasto.id,
        tipoManejoId: tipoManejo.id,
        dataAtividade: '2026-01-01T00:00:00.000Z',
        ...extra,
    });

    it('MPAS-POST-01 cria manejo sem itens', async () => {
        const r = await post(a, corpoBase());
        expect(r.status).toBe(201);
        expect(r.body.errors).toEqual([]);
        expect(r.body.data.itens).toEqual([]);
    });

    it('MPAS-POST-02 cria manejo com 1 item de insumo destino "Pasto"', async () => {
        const insumo = await criarInsumo(propriedade.id, { destino: 'Pasto' });
        const r = await post(a, corpoBase({ itens: [{ insumoId: insumo.id, quantidade: 10 }] }));
        expect(r.status).toBe(201);
        expect(r.body.data.itens[0]).toBeDefined();

        const mov = await DbConnect.prisma.movimentacaoInsumo.findFirst({
            where: { manejoPastoId: r.body.data.id },
        });
        expect(mov).toMatchObject({
            tipo: 'Saida',
            origem: 'ManejoPasto',
            manejoPastoId: r.body.data.id,
            pastoId: pasto.id,
        });
    });

    it('MPAS-POST-03 cria manejo com item de insumo destino "Ambos"', async () => {
        const insumo = await criarInsumo(propriedade.id, { destino: 'Ambos' });
        const r = await post(a, corpoBase({ itens: [{ insumoId: insumo.id, quantidade: 10 }] }));
        expect(r.status).toBe(201);
        expect(r.body.data.itens[0]).toBeDefined();

        const mov = await DbConnect.prisma.movimentacaoInsumo.findFirst({
            where: { manejoPastoId: r.body.data.id },
        });
        expect(mov).toMatchObject({
            tipo: 'Saida',
            origem: 'ManejoPasto',
            manejoPastoId: r.body.data.id,
            pastoId: pasto.id,
        });
    });

    it('MPAS-POST-04 aceita id do manejo gerado pelo cliente (offline-first)', async () => {
        const id = randomUUID();
        const r = await post(a, corpoBase({ id }));
        expect(r.status).toBe(201);
        expect(r.body.data.id).toBe(id);
    });

    it('MPAS-POST-05 aceita id do item gerado pelo cliente', async () => {
        const insumo = await criarInsumo(propriedade.id, { destino: 'Pasto' });
        const itemId = randomUUID();
        const r = await post(a, corpoBase({ itens: [{ id: itemId, insumoId: insumo.id, quantidade: 3 }] }));
        expect(r.status).toBe(201);

        const mov = await DbConnect.prisma.movimentacaoInsumo.findUnique({ where: { id: itemId } });
        expect(mov).not.toBeNull();
        expect(mov.manejoPastoId).toBe(r.body.data.id);
    });

    it('MPAS-POST-06 corpo vazio', async () => {
        const r = await post(a, {});
        expect(r.status).toBe(400);
        expect(r.body.errors[0].path).toBe('body');
        expect(r.body.message).toBe('Forneça os dados do manejo de pasto.');
    });

    it('MPAS-POST-07 sem pastoId', async () => {
        const { pastoId, ...corpo } = corpoBase();
        const r = await post(a, corpo);
        expect(r.status).toBe(400);
        expect(r.body.errors[0].path).toBe('pastoId');
    });

    it('MPAS-POST-08 sem tipoManejoId', async () => {
        const { tipoManejoId, ...corpo } = corpoBase();
        const r = await post(a, corpo);
        expect(r.status).toBe(400);
        expect(r.body.errors[0].path).toBe('tipoManejoId');
    });

    it('MPAS-POST-09 sem dataAtividade', async () => {
        const { dataAtividade, ...corpo } = corpoBase();
        const r = await post(a, corpo);
        expect(r.status).toBe(400);
        expect(r.body.errors[0].path).toBe('dataAtividade');
    });

    it('MPAS-POST-10 dataAtividade no futuro', async () => {
        const r = await post(a, corpoBase({ dataAtividade: '2999-01-01T00:00:00.000Z' }));
        expect(r.status).toBe(400);
        expect(r.body.errors[0].path).toBe('dataAtividade');
        expect(r.body.errors[0].message).toContain('não pode ser no futuro');
    });

    it('MPAS-POST-11 campo extra no corpo (.strict())', async () => {
        const r = await post(a, corpoBase({ extra: 1 }));
        expect(r.status).toBe(400);
        expect(r.body.errors[0].message).toContain('extra');
    });

    it('MPAS-POST-12 item de itens com campo extra (.strict() no item)', async () => {
        const insumo = await criarInsumo(propriedade.id, { destino: 'Pasto' });
        const r = await post(a, corpoBase({ itens: [{ insumoId: insumo.id, quantidade: 1, extra: 2 }] }));
        expect(r.status).toBe(400);
        expect(r.body.errors[0].path).toBe('itens.0');
        expect(r.body.errors[0].message).toContain('extra');
    });

    it('MPAS-POST-13 mais de 50 itens em itens', async () => {
        const insumoId = randomUUID();
        const itens = Array.from({ length: 51 }, () => ({ insumoId, quantidade: 1 }));
        const r = await post(a, corpoBase({ itens }));
        expect(r.status).toBe(400);
        expect(r.body.errors[0].message).toBe('No máximo 50 itens de insumo por manejo.');
    });

    it('MPAS-POST-14 item com quantidade zero ou negativa', async () => {
        const insumo = await criarInsumo(propriedade.id, { destino: 'Pasto' });
        const r = await post(a, corpoBase({ itens: [{ insumoId: insumo.id, quantidade: 0 }] }));
        expect(r.status).toBe(400);
        expect(r.body.errors[0].path).toBe('itens.0.quantidade');
    });

    it('MPAS-POST-15 pastoId inexistente', async () => {
        const r = await post(a, corpoBase({ pastoId: randomUUID() }));
        expect(r.status).toBe(404);
        expect(r.body.tipo).toBe('resourceNotFound');
        expect(r.body.message).toBe('Pastagem não encontrada ou não pertence ao usuário autenticado.');
    });

    it('MPAS-POST-16 multi-tenancy: B tenta criar manejo em pasto de A', async () => {
        const b = await criarUsuario();
        const r = await post(b, corpoBase());
        expect(r.status).toBe(404);
        expect(r.body.tipo).toBe('resourceNotFound');
        expect(r.body.message).toBe('Pastagem não encontrada ou não pertence ao usuário autenticado.');
    });

    it('MPAS-POST-17 pastoId aponta para pasto inativo', async () => {
        const pastoInativo = await criarPasto(propriedade.id, { ativo: false });
        const r = await post(a, corpoBase({ pastoId: pastoInativo.id }));
        expect(r.status).toBe(400);
        expect(r.body.tipo).toBe('validationError');
        expect(r.body.errors[0].path).toBe('pastoId');
        expect(r.body.message).toBe('Pasto está inativo.');
    });

    it('MPAS-POST-18 tipoManejoId inexistente ou inativo no catálogo', async () => {
        const r = await post(a, corpoBase({ tipoManejoId: randomUUID() }));
        expect(r.status).toBe(404);
        expect(r.body.tipo).toBe('resourceNotFound');
        expect(r.body.errors[0].path).toBe('tipoManejoId');
    });

    it('MPAS-POST-19 item com insumoId que não existe na propriedade do pasto', async () => {
        const r = await post(a, corpoBase({ itens: [{ insumoId: randomUUID(), quantidade: 1 }] }));
        expect(r.status).toBe(400);
        expect(r.body.tipo).toBe('validationError');
        expect(r.body.errors[0].path).toBe('itens');
        expect(r.body.errors[0].message).toContain('não encontrado nesta propriedade');
    });

    it('MPAS-POST-20 item com insumoId de outra propriedade do mesmo usuário', async () => {
        const outraPropriedade = await criarPropriedade(a.id);
        const insumoDeOutraPropriedade = await criarInsumo(outraPropriedade.id, { destino: 'Pasto' });
        const r = await post(a, corpoBase({ itens: [{ insumoId: insumoDeOutraPropriedade.id, quantidade: 1 }] }));
        expect(r.status).toBe(400);
        expect(r.body.errors[0].path).toBe('itens');
        expect(r.body.errors[0].message).toContain('não encontrado nesta propriedade');
    });

    it('MPAS-POST-21 item com insumoId de insumo destino "Rebanho"', async () => {
        const insumo = await criarInsumo(propriedade.id, { destino: 'Rebanho' });
        const r = await post(a, corpoBase({ itens: [{ insumoId: insumo.id, quantidade: 1 }] }));
        expect(r.status).toBe(400);
        expect(r.body.errors[0].path).toBe('itens');
        expect(r.body.errors[0].message).toContain('não é destinado ao pasto');
    });

    it('MPAS-POST-22 dois itens com o mesmo insumoId repetido fundem numa só movimentação, somando a quantidade', async () => {
        const insumo = await criarInsumo(propriedade.id, { destino: 'Pasto' });
        const r = await post(a, corpoBase({
            itens: [
                { insumoId: insumo.id, quantidade: 1 },
                { insumoId: insumo.id, quantidade: 2 },
            ],
        }));
        expect(r.status).toBe(201);

        const movimentacoes = await DbConnect.prisma.movimentacaoInsumo.findMany({
            where: { manejoPastoId: r.body.data.id },
        });
        expect(movimentacoes).toHaveLength(1);
        expect(Number(movimentacoes[0].quantidade)).toBe(3);
    });

    it('MPAS-POST-23 saída deixa o saldo do insumo negativo', async () => {
        const insumo = await criarInsumo(propriedade.id, { destino: 'Pasto' });
        const r = await post(a, corpoBase({ itens: [{ insumoId: insumo.id, quantidade: 5 }] }));
        expect(r.status).toBe(201);
        expect(r.body.data.avisos).toBeDefined();
        expect(r.body.data.avisos[0]).toContain('Estoque insuficiente');
        expect(r.body.data.avisos[0]).toContain('saldo ficará negativo');
    });

    it('MPAS-POST-24 sem token', async () => {
        const r = await api().post('/v1/pastagens/manejos').send(corpoBase());
        expect(r.status).toBe(401);
        expect(r.body.tipo).toBe('unauthorized');
    });
});
