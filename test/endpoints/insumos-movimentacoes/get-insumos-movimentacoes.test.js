import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { api } from '../../apoio/cliente.js';
import { criarUsuario } from '../../apoio/auth.js';
import { criarPropriedade, criarTipoInsumo, criarInsumo } from '../../apoio/fabricas.js';
import { criarMovimentacaoInsumo } from './apoio-local.js';

describe('GET /v1/insumos/movimentacoes', () => {
    let a;
    let propriedade;
    let tipoInsumo;
    let insumo;

    beforeEach(async () => {
        a = await criarUsuario();
        propriedade = await criarPropriedade(a.id);
        tipoInsumo = await criarTipoInsumo();
        insumo = await criarInsumo(propriedade.id, { tipoInsumoId: tipoInsumo.id });
    });

    const get = (usuario, query = '') =>
        api().get(`/v1/insumos/movimentacoes${query}`).set('Authorization', usuario.bearer);

    it('MINS-GET-01 lista com insumoId', async () => {
        const outroInsumo = await criarInsumo(propriedade.id, { tipoInsumoId: tipoInsumo.id });
        const mov1 = await criarMovimentacaoInsumo(insumo.id, { data: new Date('2026-01-01T00:00:00Z') });
        const mov2 = await criarMovimentacaoInsumo(insumo.id, { data: new Date('2026-01-03T00:00:00Z') });
        await criarMovimentacaoInsumo(outroInsumo.id);

        const r = await get(a, `?insumoId=${insumo.id}`);
        expect(r.status).toBe(200);
        expect(r.body.data.docs).toHaveLength(2);
        expect(r.body.data.docs.every((d) => d.insumoId === insumo.id)).toBe(true);
        expect(r.body.data.docs.map((d) => d.id)).toEqual([mov2.id, mov1.id]);
    });

    it('MINS-GET-02 sem insumoId e sem atualizadoDesde', async () => {
        const r = await get(a);
        expect(r.status).toBe(400);
        expect(r.body.tipo).toBe('validationError');
        expect(r.body.message).toBe('Informe o insumo.');
        expect(r.body.errors[0].path).toBe('insumoId');
    });

    it('MINS-GET-03 sem insumoId, com atualizadoDesde', async () => {
        const outroInsumo = await criarInsumo(propriedade.id, { tipoInsumoId: tipoInsumo.id });
        const mov1 = await criarMovimentacaoInsumo(insumo.id);
        const mov2 = await criarMovimentacaoInsumo(outroInsumo.id);

        const r = await get(a, `?atualizadoDesde=${new Date(0).toISOString()}`);
        expect(r.status).toBe(200);
        const ids = r.body.data.docs.map((d) => d.id);
        expect(ids).toContain(mov1.id);
        expect(ids).toContain(mov2.id);
    });

    it('MINS-GET-04 atualizadoDesde + propriedadeId', async () => {
        const outraPropriedade = await criarPropriedade(a.id);
        const insumoOutra = await criarInsumo(outraPropriedade.id, { tipoInsumoId: tipoInsumo.id });
        const movDaqui = await criarMovimentacaoInsumo(insumo.id);
        const movDeLa = await criarMovimentacaoInsumo(insumoOutra.id);

        const r = await get(a, `?atualizadoDesde=${new Date(0).toISOString()}&propriedadeId=${propriedade.id}`);
        expect(r.status).toBe(200);
        const ids = r.body.data.docs.map((d) => d.id);
        expect(ids).toContain(movDaqui.id);
        expect(ids).not.toContain(movDeLa.id);
    });

    it('MINS-GET-05 filtro tipo', async () => {
        const entrada = await criarMovimentacaoInsumo(insumo.id, { tipo: 'Entrada' });
        await criarMovimentacaoInsumo(insumo.id, { tipo: 'Saida', origem: 'Perda' });

        const r = await get(a, `?insumoId=${insumo.id}&tipo=Entrada`);
        expect(r.status).toBe(200);
        expect(r.body.data.docs).toHaveLength(1);
        expect(r.body.data.docs[0].id).toBe(entrada.id);
    });

    it('MINS-GET-06 filtro origem', async () => {
        const compra = await criarMovimentacaoInsumo(insumo.id, { origem: 'Compra' });
        await criarMovimentacaoInsumo(insumo.id, { tipo: 'Saida', origem: 'Perda' });

        const r = await get(a, `?insumoId=${insumo.id}&origem=Compra`);
        expect(r.status).toBe(200);
        expect(r.body.data.docs).toHaveLength(1);
        expect(r.body.data.docs[0].id).toBe(compra.id);
    });

    it('MINS-GET-07 filtro dataInicio/dataFim', async () => {
        await criarMovimentacaoInsumo(insumo.id, { data: new Date('2026-01-01T00:00:00Z') });
        const meio = await criarMovimentacaoInsumo(insumo.id, { data: new Date('2026-01-10T00:00:00Z') });
        await criarMovimentacaoInsumo(insumo.id, { data: new Date('2026-01-20T00:00:00Z') });

        const r = await get(a, `?insumoId=${insumo.id}&dataInicio=2026-01-05&dataFim=2026-01-15`);
        expect(r.status).toBe(200);
        expect(r.body.data.docs).toHaveLength(1);
        expect(r.body.data.docs[0].id).toBe(meio.id);
    });

    it('MINS-GET-08 filtro ativo=false', async () => {
        await criarMovimentacaoInsumo(insumo.id, { ativo: true });
        const estornada = await criarMovimentacaoInsumo(insumo.id, { ativo: false });

        const r = await get(a, `?insumoId=${insumo.id}&ativo=false`);
        expect(r.status).toBe(200);
        expect(r.body.data.docs).toHaveLength(1);
        expect(r.body.data.docs[0].id).toBe(estornada.id);
    });

    it('MINS-GET-09 sem query além de insumoId', async () => {
        await criarMovimentacaoInsumo(insumo.id);
        const r = await get(a, `?insumoId=${insumo.id}`);
        expect(r.status).toBe(200);
        expect(r.body.data.page).toBe(1);
        expect(r.body.data.limit).toBe(10);
    });

    it('MINS-GET-10 limit > 100', async () => {
        const r = await get(a, `?insumoId=${insumo.id}&limit=101`);
        expect(r.status).toBe(400);
        expect(r.body.tipo).toBe('validationError');
    });

    it('MINS-GET-11 campo extra na query (.strict())', async () => {
        const r = await get(a, `?insumoId=${insumo.id}&extra=1`);
        expect(r.status).toBe(400);
        expect(r.body.tipo).toBe('validationError');
    });

    it('MINS-GET-12 sem token', async () => {
        const r = await api().get(`/v1/insumos/movimentacoes?insumoId=${insumo.id}`);
        expect(r.status).toBe(401);
        expect(r.body.tipo).toBe('unauthorized');
    });

    it('MINS-GET-13 multi-tenancy: insumoId de A, logado como B', async () => {
        const b = await criarUsuario();
        const r = await get(b, `?insumoId=${insumo.id}`);
        expect(r.status).toBe(404);
        expect(r.body.message).toBe('Insumo não encontrado ou não pertence ao usuário autenticado.');
    });

    it('MINS-GET-14 multi-tenancy: propriedadeId de A + atualizadoDesde, logado como B', async () => {
        await criarMovimentacaoInsumo(insumo.id);
        const b = await criarUsuario();

        const r = await get(b, `?atualizadoDesde=${new Date(0).toISOString()}&propriedadeId=${propriedade.id}`);
        expect(r.status).toBe(200);
        expect(r.body.data.docs).toEqual([]);
    });

    it('MINS-GET-15 lista vazia', async () => {
        const r = await get(a, `?insumoId=${insumo.id}`);
        expect(r.status).toBe(200);
        expect(r.body.message).toBe('Nenhuma movimentação encontrada.');
        expect(r.body.data.docs).toEqual([]);
    });
});
