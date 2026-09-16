import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import DbConnect from '../../../src/config/dbConnect.js';
import { api } from '../../apoio/cliente.js';
import { criarUsuario } from '../../apoio/auth.js';
import { criarPropriedade, criarTipoInsumo, criarInsumo } from '../../apoio/fabricas.js';
import { criarMovimentacaoInsumo } from './apoio-local.js';

describe('DELETE /v1/insumos/movimentacoes/:id', () => {
    let a;
    let propriedade;
    let insumo;

    beforeEach(async () => {
        a = await criarUsuario();
        propriedade = await criarPropriedade(a.id);
        const tipoInsumo = await criarTipoInsumo();
        insumo = await criarInsumo(propriedade.id, { tipoInsumoId: tipoInsumo.id });
    });

    const del = (usuario, id) =>
        api().delete(`/v1/insumos/movimentacoes/${id}`).set('Authorization', usuario.bearer);

    it('MINS-DELETE-ID-01 estorna (soft-delete)', async () => {
        const mov = await criarMovimentacaoInsumo(insumo.id, { tipo: 'Entrada', quantidade: 100 });

        const r = await del(a, mov.id);
        expect(r.status).toBe(200);
        expect(r.body.message).toBe('Movimentação excluída com sucesso.');

        const salva = await DbConnect.prisma.movimentacaoInsumo.findUnique({ where: { id: mov.id } });
        expect(salva.ativo).toBe(false);

        const insumoAtualizado = await api().get(`/v1/insumos/${insumo.id}`).set('Authorization', a.bearer);
        expect(insumoAtualizado.body.data.saldo.saldoReal).toBe(0);
    });

    it('MINS-DELETE-ID-02 id não é UUID', async () => {
        const r = await del(a, 'nao-e-uuid');
        expect(r.status).toBe(400);
        expect(r.body.tipo).toBe('validationError');
    });

    it('MINS-DELETE-ID-03 sem token', async () => {
        const mov = await criarMovimentacaoInsumo(insumo.id);
        const r = await api().delete(`/v1/insumos/movimentacoes/${mov.id}`);
        expect(r.status).toBe(401);
        expect(r.body.tipo).toBe('unauthorized');
    });

    it('MINS-DELETE-ID-04 id inexistente', async () => {
        const r = await del(a, randomUUID());
        expect(r.status).toBe(404);
        expect(r.body.message).toBe('Recurso não encontrado em Movimentação de Insumo.');
    });

    it('MINS-DELETE-ID-05 multi-tenancy: B exclui id de movimentação de A', async () => {
        const mov = await criarMovimentacaoInsumo(insumo.id);
        const b = await criarUsuario();

        const r = await del(b, mov.id);
        expect(r.status).toBe(404);
        expect(r.body.message).toBe('Recurso não encontrado em Movimentação de Insumo.');
        const salva = await DbConnect.prisma.movimentacaoInsumo.findUnique({ where: { id: mov.id } });
        expect(salva.ativo).toBe(true);
    });
});
