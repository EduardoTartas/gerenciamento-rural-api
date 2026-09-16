import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import DbConnect from '../../../src/config/dbConnect.js';
import { api } from '../../apoio/cliente.js';
import { criarUsuario } from '../../apoio/auth.js';
import { criarPropriedade, criarPasto, criarRebanho, criarInsumo, criarTipoManejoRebanho } from '../../apoio/fabricas.js';
import { criarManejoRebanho } from './apoio-local.js';

describe('DELETE /v1/rebanhos/manejos/:id', () => {
    let a, propriedade, pasto, rebanho, tipoManejo;

    beforeEach(async () => {
        a = await criarUsuario();
        propriedade = await criarPropriedade(a.id);
        pasto = await criarPasto(propriedade.id);
        rebanho = await criarRebanho(propriedade.id, pasto.id);
        tipoManejo = await criarTipoManejoRebanho();
    });

    const del = (usuario, id) =>
        api().delete(`/v1/rebanhos/manejos/${id}`).set('Authorization', usuario.bearer);

    // Soft-delete: ManejoRebanhoRepository.remove faz update({ ativo: false }),
    // não apaga a linha. Documentação de rotas está desatualizada nesse ponto
    // (ver seção Divergências do .md) — comportamento atual vira teste normal.
    it('MREB-DELETE-ID-01 remove manejo de A (soft-delete)', async () => {
        const manejo = await criarManejoRebanho(rebanho.id, tipoManejo.id);
        const r = await del(a, manejo.id);
        expect(r.status).toBe(200);
        expect(r.body.message).toBe('Manejo de rebanho excluído com sucesso.');

        const salvo = await DbConnect.prisma.manejoRebanho.findUnique({ where: { id: manejo.id } });
        expect(salvo).not.toBeNull();
        expect(salvo.ativo).toBe(false);
    });

    it('MREB-DELETE-ID-02 desativa movimentações de insumo vinculadas', async () => {
        const manejo = await criarManejoRebanho(rebanho.id, tipoManejo.id);
        const insumo = await criarInsumo(propriedade.id, { destino: 'Rebanho' });
        const mov = await DbConnect.prisma.movimentacaoInsumo.create({
            data: {
                insumoId: insumo.id,
                tipo: 'Saida',
                quantidade: 4,
                data: new Date(),
                origem: 'ManejoRebanho',
                manejoRebanhoId: manejo.id,
                rebanhoId: rebanho.id,
            },
        });

        const r = await del(a, manejo.id);
        expect(r.status).toBe(200);

        const movSalva = await DbConnect.prisma.movimentacaoInsumo.findUnique({ where: { id: mov.id } });
        expect(movSalva.ativo).toBe(false);
    });

    it('MREB-DELETE-ID-03 id não é UUID', async () => {
        const r = await del(a, 'nao-e-uuid');
        expect(r.status).toBe(400);
        expect(r.body.tipo).toBe('validationError');
    });

    it('MREB-DELETE-ID-04 id inexistente', async () => {
        const r = await del(a, randomUUID());
        expect(r.status).toBe(404);
        expect(r.body.tipo).toBe('resourceNotFound');
    });

    it('MREB-DELETE-ID-05 sem token', async () => {
        const manejo = await criarManejoRebanho(rebanho.id, tipoManejo.id);
        const r = await api().delete(`/v1/rebanhos/manejos/${manejo.id}`);
        expect(r.status).toBe(401);
        expect(r.body.tipo).toBe('unauthorized');
    });

    it('MREB-DELETE-ID-06 multi-tenancy: B tenta remover manejo de A', async () => {
        const manejo = await criarManejoRebanho(rebanho.id, tipoManejo.id);
        const b = await criarUsuario();
        const r = await del(b, manejo.id);
        expect(r.status).toBe(404);
        expect(r.body.tipo).toBe('resourceNotFound');

        const salvo = await DbConnect.prisma.manejoRebanho.findUnique({ where: { id: manejo.id } });
        expect(salvo.ativo).toBe(true);
    });

    it('MREB-DELETE-ID-07 admin (não dono) tenta remover manejo de A', async () => {
        const manejo = await criarManejoRebanho(rebanho.id, tipoManejo.id);
        const admin = await criarUsuario({ admin: true });
        const r = await del(admin, manejo.id);
        expect(r.status).toBe(404);
        expect(r.body.tipo).toBe('resourceNotFound');
    });
});
