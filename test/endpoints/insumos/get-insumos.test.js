import { beforeEach, describe, expect, it } from 'vitest';
import { api } from '../../apoio/cliente.js';
import { criarUsuario } from '../../apoio/auth.js';
import { criarPropriedade, criarTipoInsumo, criarInsumo } from '../../apoio/fabricas.js';
import { criarMovimentacaoInsumo } from './apoio-local.js';

describe('GET /v1/insumos', () => {
    let a;
    let propriedade;
    let tipoInsumo;

    beforeEach(async () => {
        a = await criarUsuario();
        propriedade = await criarPropriedade(a.id);
        tipoInsumo = await criarTipoInsumo();
    });

    const get = (usuario, query = '') =>
        api().get(`/v1/insumos${query}`).set('Authorization', usuario.bearer);

    it('INS-GET-01 lista paginada, cada item com saldo agregado do resumo do ledger', async () => {
        const i1 = await criarInsumo(propriedade.id, { nome: 'Adubo', tipoInsumoId: tipoInsumo.id });
        const i2 = await criarInsumo(propriedade.id, { nome: 'Sal', tipoInsumoId: tipoInsumo.id });
        await criarMovimentacaoInsumo(i1.id, { tipo: 'Entrada', quantidade: 50 });
        await criarMovimentacaoInsumo(i2.id, { tipo: 'Entrada', quantidade: 20 });

        const r = await get(a);
        expect(r.status).toBe(200);
        expect(r.body.data.docs).toHaveLength(2);
        for (const doc of r.body.data.docs) {
            expect(doc.saldo).toBeDefined();
            expect(doc).not.toHaveProperty('movimentacoes');
            expect(doc).not.toHaveProperty('regimesConsumo');
            expect(doc).not.toHaveProperty('_resumoLedger');
        }
        expect(r.body.data.totalDocs).toBe(2);
        expect(r.body.data.page).toBe(1);
        expect(r.body.data.limit).toBe(10);
        expect(r.body.data.totalPages).toBe(1);
        expect(r.body.data.docs.map((d) => d.nome)).toEqual(['Adubo', 'Sal']);
    });

    it('INS-GET-02 filtro propriedadeId', async () => {
        const outraPropriedade = await criarPropriedade(a.id);
        await criarInsumo(propriedade.id, { nome: 'Da propriedade 1', tipoInsumoId: tipoInsumo.id });
        await criarInsumo(outraPropriedade.id, { nome: 'Da propriedade 2', tipoInsumoId: tipoInsumo.id });

        const r = await get(a, `?propriedadeId=${propriedade.id}`);
        expect(r.status).toBe(200);
        expect(r.body.data.docs).toHaveLength(1);
        expect(r.body.data.docs[0].nome).toBe('Da propriedade 1');
    });

    it('INS-GET-03 filtro tipoInsumoId', async () => {
        const outroTipo = await criarTipoInsumo();
        await criarInsumo(propriedade.id, { nome: 'Do tipo 1', tipoInsumoId: tipoInsumo.id });
        await criarInsumo(propriedade.id, { nome: 'Do tipo 2', tipoInsumoId: outroTipo.id });

        const r = await get(a, `?tipoInsumoId=${tipoInsumo.id}`);
        expect(r.status).toBe(200);
        expect(r.body.data.docs).toHaveLength(1);
        expect(r.body.data.docs[0].nome).toBe('Do tipo 1');
    });

    it('INS-GET-04 filtro destino', async () => {
        await criarInsumo(propriedade.id, { nome: 'Para pasto', tipoInsumoId: tipoInsumo.id, destino: 'Pasto' });
        await criarInsumo(propriedade.id, { nome: 'Para rebanho', tipoInsumoId: tipoInsumo.id, destino: 'Rebanho' });

        const r = await get(a, '?destino=Pasto');
        expect(r.status).toBe(200);
        expect(r.body.data.docs).toHaveLength(1);
        expect(r.body.data.docs[0].nome).toBe('Para pasto');
    });

    it('INS-GET-05 filtro nome (contém, case-insensitive)', async () => {
        await criarInsumo(propriedade.id, { nome: 'Ração Bovina', tipoInsumoId: tipoInsumo.id });
        await criarInsumo(propriedade.id, { nome: 'Sal Mineral', tipoInsumoId: tipoInsumo.id });

        const r = await get(a, '?nome=ração');
        expect(r.status).toBe(200);
        expect(r.body.data.docs).toHaveLength(1);
        expect(r.body.data.docs[0].nome).toBe('Ração Bovina');
    });

    it('INS-GET-06 filtro ativo=false', async () => {
        await criarInsumo(propriedade.id, { nome: 'Ativo', tipoInsumoId: tipoInsumo.id });
        await criarInsumo(propriedade.id, { nome: 'Inativo', tipoInsumoId: tipoInsumo.id, ativo: false });

        const r = await get(a, '?ativo=false');
        expect(r.status).toBe(200);
        expect(r.body.data.docs).toHaveLength(1);
        expect(r.body.data.docs[0].nome).toBe('Inativo');
    });

    it('INS-GET-07 filtro atualizadoDesde', async () => {
        await criarInsumo(propriedade.id, { nome: 'Sempre ativo', tipoInsumoId: tipoInsumo.id });
        const marca = new Date();
        await new Promise((resolve) => setTimeout(resolve, 20));
        const inativado = await criarInsumo(propriedade.id, { nome: 'Inativado depois', tipoInsumoId: tipoInsumo.id, ativo: false });

        const r = await get(a, `?atualizadoDesde=${marca.toISOString()}`);
        expect(r.status).toBe(200);
        expect(r.body.data.docs.map((d) => d.id)).toContain(inativado.id);
    });

    it('INS-GET-08 estoqueBaixo = true', async () => {
        const insumo = await criarInsumo(propriedade.id, { nome: 'Baixo', tipoInsumoId: tipoInsumo.id, estoqueMinimo: 50 });
        await criarMovimentacaoInsumo(insumo.id, { tipo: 'Entrada', quantidade: 30 });

        const r = await get(a);
        expect(r.status).toBe(200);
        const doc = r.body.data.docs.find((d) => d.id === insumo.id);
        expect(doc.saldo.estoqueBaixo).toBe(true);
    });

    it('INS-GET-09 estoqueBaixo = false quando estoqueMinimo é null', async () => {
        const insumo = await criarInsumo(propriedade.id, { nome: 'Sem minimo', tipoInsumoId: tipoInsumo.id, estoqueMinimo: null });
        await criarMovimentacaoInsumo(insumo.id, { tipo: 'Entrada', quantidade: 5 });

        const r = await get(a);
        expect(r.status).toBe(200);
        const doc = r.body.data.docs.find((d) => d.id === insumo.id);
        expect(doc.saldo.estoqueBaixo).toBe(false);
    });

    it('INS-GET-10 sem query', async () => {
        const r = await get(a);
        expect(r.status).toBe(200);
        expect(r.body.data.page).toBe(1);
        expect(r.body.data.limit).toBe(10);
    });

    it('INS-GET-11 limit > 100', async () => {
        const r = await get(a, '?limit=101');
        expect(r.status).toBe(400);
        expect(r.body.tipo).toBe('validationError');
    });

    it('INS-GET-12 campo extra na query (.strict())', async () => {
        const r = await get(a, '?extra=1');
        expect(r.status).toBe(400);
        expect(r.body.tipo).toBe('validationError');
    });

    it('INS-GET-13 sem token', async () => {
        const r = await api().get('/v1/insumos');
        expect(r.status).toBe(401);
        expect(r.body.tipo).toBe('unauthorized');
    });

    it('INS-GET-14 multi-tenancy: B lista insumos', async () => {
        await criarInsumo(propriedade.id, { nome: 'De A', tipoInsumoId: tipoInsumo.id });
        const b = await criarUsuario();

        const r = await get(b);
        expect(r.status).toBe(200);
        expect(r.body.data.docs.find((d) => d.nome === 'De A')).toBeUndefined();
    });

    it('INS-GET-15 lista vazia', async () => {
        const r = await get(a);
        expect(r.status).toBe(200);
        expect(r.body.message).toBe('Nenhum insumo cadastrado.');
        expect(r.body.data.docs).toEqual([]);
    });
});
