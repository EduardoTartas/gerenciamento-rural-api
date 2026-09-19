import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import DbConnect from '../../../src/config/dbConnect.js';
import { api } from '../../apoio/cliente.js';
import { criarUsuario } from '../../apoio/auth.js';
import { criarPropriedade, criarTipoInsumo, criarInsumo } from '../../apoio/fabricas.js';
import { criarMovimentacaoInsumo } from './apoio-local.js';

describe('DELETE /v1/insumos/:id', () => {
    let a;
    let propriedade;
    let tipoInsumo;

    beforeEach(async () => {
        a = await criarUsuario();
        propriedade = await criarPropriedade(a.id);
        tipoInsumo = await criarTipoInsumo();
    });

    const del = (usuario, id) =>
        api().delete(`/v1/insumos/${id}`).set('Authorization', usuario.bearer);

    it('INS-DELETE-ID-01 exclui (soft-delete)', async () => {
        const insumo = await criarInsumo(propriedade.id, { tipoInsumoId: tipoInsumo.id });
        const mov = await criarMovimentacaoInsumo(insumo.id, { tipo: 'Entrada', quantidade: 10 });

        const r = await del(a, insumo.id);
        expect(r.status).toBe(200);
        expect(r.body.message).toBe('Insumo excluído com sucesso.');

        const salvo = await DbConnect.prisma.insumo.findUnique({ where: { id: insumo.id } });
        expect(salvo.ativo).toBe(false);

        const movSalva = await DbConnect.prisma.movimentacaoInsumo.findUnique({ where: { id: mov.id } });
        expect(movSalva).not.toBeNull();
        expect(movSalva.ativo).toBe(true);
    });

    it('INS-DELETE-ID-02 id não é UUID', async () => {
        const r = await del(a, 'nao-e-uuid');
        expect(r.status).toBe(400);
        expect(r.body.tipo).toBe('validationError');
    });

    it('INS-DELETE-ID-03 sem token', async () => {
        const insumo = await criarInsumo(propriedade.id, { tipoInsumoId: tipoInsumo.id });
        const r = await api().delete(`/v1/insumos/${insumo.id}`);
        expect(r.status).toBe(401);
        expect(r.body.tipo).toBe('unauthorized');
    });

    it('INS-DELETE-ID-04 id inexistente', async () => {
        const r = await del(a, randomUUID());
        expect(r.status).toBe(404);
        expect(r.body.message).toBe('Recurso não encontrado em Insumo.');
    });

    it('INS-DELETE-ID-05 multi-tenancy: B exclui id de um insumo de A', async () => {
        const insumo = await criarInsumo(propriedade.id, { tipoInsumoId: tipoInsumo.id });
        const b = await criarUsuario();

        const r = await del(b, insumo.id);
        expect(r.status).toBe(404);
        expect(r.body.message).toBe('Recurso não encontrado em Insumo.');
        const salvo = await DbConnect.prisma.insumo.findUnique({ where: { id: insumo.id } });
        expect(salvo.ativo).toBe(true);
    });
});
