import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { api } from '../../apoio/cliente.js';
import { criarUsuario } from '../../apoio/auth.js';
import { criarPropriedade, criarTipoInsumo, criarInsumo } from '../../apoio/fabricas.js';
import { criarMovimentacaoInsumo } from './apoio-local.js';

describe('GET /v1/insumos/movimentacoes/:id', () => {
    let a;
    let propriedade;
    let insumo;

    beforeEach(async () => {
        a = await criarUsuario();
        propriedade = await criarPropriedade(a.id);
        const tipoInsumo = await criarTipoInsumo();
        insumo = await criarInsumo(propriedade.id, { tipoInsumoId: tipoInsumo.id });
    });

    const get = (usuario, id) =>
        api().get(`/v1/insumos/movimentacoes/${id}`).set('Authorization', usuario.bearer);

    it('MINS-GET-ID-01 encontra por id', async () => {
        const mov = await criarMovimentacaoInsumo(insumo.id);
        const r = await get(a, mov.id);
        expect(r.status).toBe(200);
        expect(r.body.message).toBe('Movimentação encontrada com sucesso.');
        expect(r.body.data.insumo).toMatchObject({ id: insumo.id, nome: insumo.nome, unidadeMedida: insumo.unidadeMedida });
    });

    it('MINS-GET-ID-02 id não é UUID', async () => {
        const r = await get(a, 'nao-e-uuid');
        expect(r.status).toBe(400);
        expect(r.body.tipo).toBe('validationError');
    });

    it('MINS-GET-ID-03 sem token', async () => {
        const mov = await criarMovimentacaoInsumo(insumo.id);
        const r = await api().get(`/v1/insumos/movimentacoes/${mov.id}`);
        expect(r.status).toBe(401);
        expect(r.body.tipo).toBe('unauthorized');
    });

    it('MINS-GET-ID-04 id inexistente', async () => {
        const r = await get(a, randomUUID());
        expect(r.status).toBe(404);
        expect(r.body.message).toBe('Recurso não encontrado em Movimentação de Insumo.');
    });

    it('MINS-GET-ID-05 multi-tenancy: B lê id de movimentação de A', async () => {
        const mov = await criarMovimentacaoInsumo(insumo.id);
        const b = await criarUsuario();
        const r = await get(b, mov.id);
        expect(r.status).toBe(404);
        expect(r.body.message).toBe('Recurso não encontrado em Movimentação de Insumo.');
    });
});
