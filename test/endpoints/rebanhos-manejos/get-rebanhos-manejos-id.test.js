import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import DbConnect from '../../../src/config/dbConnect.js';
import { api } from '../../apoio/cliente.js';
import { criarUsuario } from '../../apoio/auth.js';
import { criarPropriedade, criarPasto, criarRebanho, criarInsumo, criarTipoManejoRebanho } from '../../apoio/fabricas.js';
import { criarManejoRebanho } from './apoio-local.js';

describe('GET /v1/rebanhos/manejos/:id', () => {
    let a, propriedade, pasto, rebanho, tipoManejo;

    beforeEach(async () => {
        a = await criarUsuario();
        propriedade = await criarPropriedade(a.id);
        pasto = await criarPasto(propriedade.id);
        rebanho = await criarRebanho(propriedade.id, pasto.id);
        tipoManejo = await criarTipoManejoRebanho();
    });

    const get = (usuario, id) =>
        api().get(`/v1/rebanhos/manejos/${id}`).set('Authorization', usuario.bearer);

    it('MREB-GET-ID-01 busca manejo de A com itens', async () => {
        const manejo = await criarManejoRebanho(rebanho.id, tipoManejo.id);
        const insumo = await criarInsumo(propriedade.id, { destino: 'Rebanho' });
        const mov = await DbConnect.prisma.movimentacaoInsumo.create({
            data: {
                insumoId: insumo.id,
                tipo: 'Saida',
                quantidade: 2,
                data: new Date(),
                origem: 'ManejoRebanho',
                manejoRebanhoId: manejo.id,
                rebanhoId: rebanho.id,
            },
        });

        const r = await get(a, manejo.id);
        expect(r.status).toBe(200);
        expect(r.body.data.itens).toHaveLength(1);
        expect(r.body.data.itens[0].id).toBe(mov.id);
        expect(r.body.data.itens[0].insumo).toMatchObject({ id: insumo.id, nome: insumo.nome });
    });

    it('MREB-GET-ID-02 id não é UUID', async () => {
        const r = await get(a, 'nao-e-uuid');
        expect(r.status).toBe(400);
        expect(r.body.tipo).toBe('validationError');
    });

    it('MREB-GET-ID-03 id inexistente', async () => {
        const r = await get(a, randomUUID());
        expect(r.status).toBe(404);
        expect(r.body.tipo).toBe('resourceNotFound');
    });

    it('MREB-GET-ID-04 sem token', async () => {
        const manejo = await criarManejoRebanho(rebanho.id, tipoManejo.id);
        const r = await api().get(`/v1/rebanhos/manejos/${manejo.id}`);
        expect(r.status).toBe(401);
        expect(r.body.tipo).toBe('unauthorized');
    });

    it('MREB-GET-ID-05 multi-tenancy: B busca manejo de A', async () => {
        const manejo = await criarManejoRebanho(rebanho.id, tipoManejo.id);
        const b = await criarUsuario();
        const r = await get(b, manejo.id);
        expect(r.status).toBe(404);
        expect(r.body.tipo).toBe('resourceNotFound');
    });

    it('MREB-GET-ID-06 admin (não dono) busca manejo de A', async () => {
        const manejo = await criarManejoRebanho(rebanho.id, tipoManejo.id);
        const admin = await criarUsuario({ admin: true });
        const r = await get(admin, manejo.id);
        expect(r.status).toBe(404);
        expect(r.body.tipo).toBe('resourceNotFound');
    });
});
