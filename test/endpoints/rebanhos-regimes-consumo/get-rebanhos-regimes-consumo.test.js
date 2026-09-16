import { beforeEach, describe, expect, it } from 'vitest';
import { api } from '../../apoio/cliente.js';
import { criarUsuario } from '../../apoio/auth.js';
import { criarPropriedade, criarPasto, criarRebanho, criarInsumo } from '../../apoio/fabricas.js';
import { criarRegimeConsumo } from './apoio-local.js';

describe('GET /v1/rebanhos/regimes-consumo', () => {
    let a, propriedade, pasto, rebanho, insumo;

    beforeEach(async () => {
        a = await criarUsuario();
        propriedade = await criarPropriedade(a.id);
        pasto = await criarPasto(propriedade.id);
        rebanho = await criarRebanho(propriedade.id, pasto.id);
        insumo = await criarInsumo(propriedade.id, { destino: 'Ambos' });
    });

    const get = (usuario, query = '') =>
        api().get(`/v1/rebanhos/regimes-consumo${query}`).set('Authorization', usuario.bearer);

    it('REG-GET-01 lista paginada dos regimes do usuário, ordenado por dataInicio desc', async () => {
        const outroPasto = await criarPasto(propriedade.id);
        const outroRebanho = await criarRebanho(propriedade.id, outroPasto.id);
        const antigo = await criarRegimeConsumo(rebanho.id, insumo.id, { dataInicio: new Date('2026-01-01T00:00:00Z') });
        const recente = await criarRegimeConsumo(outroRebanho.id, insumo.id, { dataInicio: new Date('2026-02-01T00:00:00Z') });

        const r = await get(a);
        expect(r.status).toBe(200);
        expect(r.body.data.totalDocs).toBe(2);
        expect(r.body.data.page).toBe(1);
        expect(r.body.data.limit).toBe(10);
        expect(r.body.data.totalPages).toBe(1);
        expect(r.body.data.docs.map((d) => d.id)).toEqual([recente.id, antigo.id]);
    });

    it('REG-GET-02 filtro rebanhoId', async () => {
        const outroPasto = await criarPasto(propriedade.id);
        const outroRebanho = await criarRebanho(propriedade.id, outroPasto.id);
        const outroInsumo = await criarInsumo(propriedade.id, { destino: 'Ambos' });
        const doAlvo = await criarRegimeConsumo(rebanho.id, insumo.id);
        await criarRegimeConsumo(outroRebanho.id, outroInsumo.id);

        const r = await get(a, `?rebanhoId=${rebanho.id}`);
        expect(r.status).toBe(200);
        expect(r.body.data.docs).toHaveLength(1);
        expect(r.body.data.docs[0].id).toBe(doAlvo.id);
    });

    it('REG-GET-03 filtro insumoId', async () => {
        const outroInsumo = await criarInsumo(propriedade.id, { destino: 'Ambos' });
        const doAlvo = await criarRegimeConsumo(rebanho.id, insumo.id);
        await criarRegimeConsumo(rebanho.id, outroInsumo.id, { dataFim: new Date('2026-01-10T00:00:00Z'), ativo: false });

        const r = await get(a, `?insumoId=${insumo.id}`);
        expect(r.status).toBe(200);
        expect(r.body.data.docs).toHaveLength(1);
        expect(r.body.data.docs[0].id).toBe(doAlvo.id);
    });

    it('REG-GET-04 filtro emAberto=true', async () => {
        const outroInsumo = await criarInsumo(propriedade.id, { destino: 'Ambos' });
        const aberto = await criarRegimeConsumo(rebanho.id, insumo.id);
        await criarRegimeConsumo(rebanho.id, outroInsumo.id, { dataFim: new Date('2026-01-10T00:00:00Z'), ativo: false });

        const r = await get(a, '?emAberto=true');
        expect(r.status).toBe(200);
        expect(r.body.data.docs).toHaveLength(1);
        expect(r.body.data.docs[0].id).toBe(aberto.id);
        expect(r.body.data.docs[0].dataFim).toBeNull();
    });

    it('REG-GET-05 filtro ativo=false', async () => {
        const outroInsumo = await criarInsumo(propriedade.id, { destino: 'Ambos' });
        await criarRegimeConsumo(rebanho.id, insumo.id);
        const encerrado = await criarRegimeConsumo(rebanho.id, outroInsumo.id, { dataFim: new Date('2026-01-10T00:00:00Z'), ativo: false });

        const r = await get(a, '?ativo=false');
        expect(r.status).toBe(200);
        expect(r.body.data.docs).toHaveLength(1);
        expect(r.body.data.docs[0].id).toBe(encerrado.id);
    });

    it('REG-GET-06 filtro atualizadoDesde inclui o inativo (leitura por diferença)', async () => {
        const marco = new Date();
        await new Promise((resolve) => setTimeout(resolve, 10));
        const outroInsumo = await criarInsumo(propriedade.id, { destino: 'Ambos' });
        const encerrado = await criarRegimeConsumo(rebanho.id, outroInsumo.id, { dataFim: new Date('2026-01-10T00:00:00Z'), ativo: false });

        const r = await get(a, `?atualizadoDesde=${marco.toISOString()}`);
        expect(r.status).toBe(200);
        expect(r.body.data.docs.map((d) => d.id)).toContain(encerrado.id);
    });

    it('REG-GET-07 sem query usa page=1 e limit=10 (default)', async () => {
        const r = await get(a);
        expect(r.status).toBe(200);
        expect(r.body.data.page).toBe(1);
        expect(r.body.data.limit).toBe(10);
    });

    it('REG-GET-08 limit acima de 100', async () => {
        const r = await get(a, '?limit=101');
        expect(r.status).toBe(400);
        expect(r.body.tipo).toBe('validationError');
    });

    it('REG-GET-09 page <= 0', async () => {
        const r = await get(a, '?page=0');
        expect(r.status).toBe(400);
        expect(r.body.tipo).toBe('validationError');
    });

    it('REG-GET-10 campo extra na query (.strict())', async () => {
        const r = await get(a, '?extra=1');
        expect(r.status).toBe(400);
        expect(r.body.tipo).toBe('validationError');
    });

    it('REG-GET-11 sem token', async () => {
        const r = await api().get('/v1/rebanhos/regimes-consumo');
        expect(r.status).toBe(401);
        expect(r.body.tipo).toBe('unauthorized');
    });

    it('REG-GET-12 multi-tenancy: B lista regimes', async () => {
        await criarRegimeConsumo(rebanho.id, insumo.id);
        const b = await criarUsuario();

        const r = await get(b);
        expect(r.status).toBe(200);
        expect(r.body.data.docs).toEqual([]);
    });

    // REG-GET-13: divergência conhecida (issue #40) — este endpoint não aceita
    // `propriedadeId` como filtro, diferente de GET /insumos. Regimes de
    // rebanhos de propriedades diferentes do mesmo usuário aparecem juntos.
    it('REG-GET-13 sem propriedadeId disponível como filtro: regimes de propriedades diferentes aparecem juntos', async () => {
        const outraPropriedade = await criarPropriedade(a.id);
        const outroPasto = await criarPasto(outraPropriedade.id);
        const outroRebanho = await criarRebanho(outraPropriedade.id, outroPasto.id);
        const outroInsumo = await criarInsumo(outraPropriedade.id, { destino: 'Ambos' });

        const daPropriedade1 = await criarRegimeConsumo(rebanho.id, insumo.id);
        const daPropriedade2 = await criarRegimeConsumo(outroRebanho.id, outroInsumo.id);

        const r = await get(a);
        expect(r.status).toBe(200);
        const ids = r.body.data.docs.map((d) => d.id);
        expect(ids).toEqual(expect.arrayContaining([daPropriedade1.id, daPropriedade2.id]));
    });
});
