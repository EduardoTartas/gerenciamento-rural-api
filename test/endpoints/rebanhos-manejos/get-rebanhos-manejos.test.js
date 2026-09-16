import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { api } from '../../apoio/cliente.js';
import { criarUsuario } from '../../apoio/auth.js';
import { criarPropriedade, criarPasto, criarRebanho, criarTipoManejoRebanho } from '../../apoio/fabricas.js';
import { criarManejoRebanho } from './apoio-local.js';

describe('GET /v1/rebanhos/manejos', () => {
    let a, propriedade, pasto, rebanho, tipoManejo;

    beforeEach(async () => {
        a = await criarUsuario();
        propriedade = await criarPropriedade(a.id);
        pasto = await criarPasto(propriedade.id);
        rebanho = await criarRebanho(propriedade.id, pasto.id);
        tipoManejo = await criarTipoManejoRebanho();
    });

    const get = (usuario, query = '') =>
        api().get(`/v1/rebanhos/manejos${query}`).set('Authorization', usuario.bearer);

    it('MREB-GET-01 lista manejos ativos de A', async () => {
        await criarManejoRebanho(rebanho.id, tipoManejo.id, { dataAtividade: new Date('2026-01-01T00:00:00Z') });
        await criarManejoRebanho(rebanho.id, tipoManejo.id, { dataAtividade: new Date('2026-01-05T00:00:00Z') });

        const r = await get(a);
        expect(r.status).toBe(200);
        expect(r.body.data.docs.length).toBe(2);
        expect(r.body.data.docs.every((m) => m.rebanho.id === rebanho.id)).toBe(true);
    });

    it('MREB-GET-02 usuário sem manejos', async () => {
        const r = await get(a);
        expect(r.status).toBe(200);
        expect(r.body.message).toBe('Nenhum manejo de rebanho cadastrado.');
        expect(r.body.data.docs).toEqual([]);
    });

    it('MREB-GET-03 filtro sem resultado', async () => {
        const r = await get(a, `?rebanhoId=${randomUUID()}`);
        expect(r.status).toBe(200);
        expect(r.body.message).toBe('Nenhum manejo encontrado com os filtros informados.');
    });

    it('MREB-GET-04 filtro rebanhoId', async () => {
        const outroPasto = await criarPasto(propriedade.id);
        const outroRebanho = await criarRebanho(propriedade.id, outroPasto.id);
        await criarManejoRebanho(rebanho.id, tipoManejo.id);
        await criarManejoRebanho(outroRebanho.id, tipoManejo.id);

        const r = await get(a, `?rebanhoId=${rebanho.id}`);
        expect(r.status).toBe(200);
        expect(r.body.data.docs).toHaveLength(1);
        expect(r.body.data.docs[0].rebanhoId).toBe(rebanho.id);
    });

    it('MREB-GET-05 filtro tipoManejoId', async () => {
        const outroTipo = await criarTipoManejoRebanho();
        await criarManejoRebanho(rebanho.id, tipoManejo.id);
        await criarManejoRebanho(rebanho.id, outroTipo.id);

        const r = await get(a, `?tipoManejoId=${tipoManejo.id}`);
        expect(r.status).toBe(200);
        expect(r.body.data.docs).toHaveLength(1);
        expect(r.body.data.docs[0].tipoManejoId).toBe(tipoManejo.id);
    });

    it('MREB-GET-06 filtro propriedadeId', async () => {
        const outraPropriedade = await criarPropriedade(a.id);
        const outroPasto = await criarPasto(outraPropriedade.id);
        const outroRebanho = await criarRebanho(outraPropriedade.id, outroPasto.id);
        await criarManejoRebanho(rebanho.id, tipoManejo.id);
        await criarManejoRebanho(outroRebanho.id, tipoManejo.id);

        const r = await get(a, `?propriedadeId=${propriedade.id}`);
        expect(r.status).toBe(200);
        expect(r.body.data.docs).toHaveLength(1);
        expect(r.body.data.docs[0].rebanho.propriedade.id).toBe(propriedade.id);
    });

    it('MREB-GET-07 filtro dataInicio/dataFim', async () => {
        await criarManejoRebanho(rebanho.id, tipoManejo.id, { dataAtividade: new Date('2026-01-01T00:00:00Z') });
        await criarManejoRebanho(rebanho.id, tipoManejo.id, { dataAtividade: new Date('2026-06-01T00:00:00Z') });

        const r = await get(a, '?dataInicio=2026-05-01T00:00:00.000Z&dataFim=2026-07-01T00:00:00.000Z');
        expect(r.status).toBe(200);
        expect(r.body.data.docs).toHaveLength(1);
        expect(new Date(r.body.data.docs[0].dataAtividade).toISOString()).toBe('2026-06-01T00:00:00.000Z');
    });

    it('MREB-GET-08 ativo=false traz só os excluídos', async () => {
        await criarManejoRebanho(rebanho.id, tipoManejo.id);
        await criarManejoRebanho(rebanho.id, tipoManejo.id, { ativo: false });

        const r = await get(a, '?ativo=false');
        expect(r.status).toBe(200);
        expect(r.body.data.docs.length).toBeGreaterThan(0);
        expect(r.body.data.docs.every((m) => m.ativo === false)).toBe(true);
    });

    it('MREB-GET-09 atualizadoDesde (delta) traz vigentes e excluídos juntos', async () => {
        const marco = new Date();
        await new Promise((resolve) => setTimeout(resolve, 10));
        const vigente = await criarManejoRebanho(rebanho.id, tipoManejo.id);
        const excluido = await criarManejoRebanho(rebanho.id, tipoManejo.id, { ativo: false });

        const r = await get(a, `?atualizadoDesde=${marco.toISOString()}`);
        expect(r.status).toBe(200);
        const idsRetornados = r.body.data.docs.map((m) => m.id);
        expect(idsRetornados).toEqual(expect.arrayContaining([vigente.id, excluido.id]));
        for (const doc of r.body.data.docs) {
            expect(doc.ativo).toBeDefined();
            expect(doc.updatedAt).toBeDefined();
        }
    });

    it('MREB-GET-10 paginação', async () => {
        for (let i = 0; i < 3; i += 1) {
            await criarManejoRebanho(rebanho.id, tipoManejo.id, { dataAtividade: new Date(2026, 0, i + 1) });
        }

        const r = await get(a, '?limit=2');
        expect(r.status).toBe(200);
        expect(r.body.data.docs.length).toBe(2);
    });

    it('MREB-GET-11 limit acima de 100', async () => {
        const r = await get(a, '?limit=101');
        expect(r.status).toBe(400);
        expect(r.body.errors[0].path).toBe('limit');
    });

    it('MREB-GET-12 query com campo extra', async () => {
        const r = await get(a, '?extra=1');
        expect(r.status).toBe(400);
        expect(r.body.tipo).toBe('validationError');
    });

    it('MREB-GET-13 sem token', async () => {
        const r = await api().get('/v1/rebanhos/manejos');
        expect(r.status).toBe(401);
        expect(r.body.tipo).toBe('unauthorized');
    });

    it('MREB-GET-14 admin (não dono) lista', async () => {
        await criarManejoRebanho(rebanho.id, tipoManejo.id);
        const b = await criarUsuario();
        const propriedadeB = await criarPropriedade(b.id);
        const pastoB = await criarPasto(propriedadeB.id);
        const rebanhoB = await criarRebanho(propriedadeB.id, pastoB.id);
        const manejoB = await criarManejoRebanho(rebanhoB.id, tipoManejo.id);

        const admin = await criarUsuario({ admin: true });
        const r = await get(admin);
        expect(r.status).toBe(200);
        const ids = r.body.data.docs.map((m) => m.id);
        expect(ids).not.toContain(manejoB.id);
    });

    it('MREB-GET-15 multi-tenancy: B não vê manejos de A', async () => {
        await criarManejoRebanho(rebanho.id, tipoManejo.id);
        const b = await criarUsuario();

        const r = await get(b);
        expect(r.status).toBe(200);
        expect(r.body.data.docs).toEqual([]);
    });
});
