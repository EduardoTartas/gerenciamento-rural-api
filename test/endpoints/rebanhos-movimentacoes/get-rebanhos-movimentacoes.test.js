import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { api } from '../../apoio/cliente.js';
import { criarUsuario } from '../../apoio/auth.js';
import { criarPropriedade, criarPasto, criarRebanho } from '../../apoio/fabricas.js';
import { registrarMovimentacao } from './apoio-local.js';

describe('GET /v1/rebanhos/movimentacoes', () => {
    let a, propriedadeA, pastoOrigemA, pastoDestinoA, rebanhoA;

    beforeEach(async () => {
        a = await criarUsuario();
        propriedadeA = await criarPropriedade(a.id);
        pastoOrigemA = await criarPasto(propriedadeA.id);
        pastoDestinoA = await criarPasto(propriedadeA.id);
        rebanhoA = await criarRebanho(propriedadeA.id, pastoOrigemA.id);
    });

    const get = (usuario, query = '') =>
        api().get(`/v1/rebanhos/movimentacoes${query}`).set('Authorization', usuario.bearer);

    it('MOV-GET-01 lista movimentações ativas de A', async () => {
        const pastoDestino2 = await criarPasto(propriedadeA.id);
        await registrarMovimentacao(a, { rebanhoId: rebanhoA.id, pastoDestinoId: pastoDestinoA.id });
        await registrarMovimentacao(a, { rebanhoId: rebanhoA.id, pastoDestinoId: pastoDestino2.id });

        const r = await get(a);
        expect(r.status).toBe(200);
        expect(r.body.data.docs.length).toBe(2);
        expect(r.body.data.docs.every((m) => m.rebanho.id === rebanhoA.id)).toBe(true);
    });

    it('MOV-GET-02 usuário sem movimentações', async () => {
        const r = await get(a);
        expect(r.status).toBe(200);
        expect(r.body.message).toBe('Nenhuma movimentação registrada.');
        expect(r.body.data.docs).toEqual([]);
    });

    it('MOV-GET-03 filtro sem resultado', async () => {
        const r = await get(a, `?rebanhoId=${randomUUID()}`);
        expect(r.status).toBe(200);
        expect(r.body.message).toBe('Nenhuma movimentação encontrada com os filtros informados.');
    });

    it('MOV-GET-04 ordenação por dataMovimentacao decrescente', async () => {
        const pastoB = await criarPasto(propriedadeA.id);
        const pastoC = await criarPasto(propriedadeA.id);

        const mov1 = await registrarMovimentacao(a, {
            rebanhoId: rebanhoA.id,
            pastoDestinoId: pastoDestinoA.id,
            dataMovimentacao: '2026-01-10T00:00:00.000Z',
        });
        const mov2 = await registrarMovimentacao(a, {
            rebanhoId: rebanhoA.id,
            pastoDestinoId: pastoB.id,
            dataMovimentacao: '2026-01-05T00:00:00.000Z',
        });
        const mov3 = await registrarMovimentacao(a, {
            rebanhoId: rebanhoA.id,
            pastoDestinoId: pastoC.id,
            dataMovimentacao: '2026-01-15T00:00:00.000Z',
        });

        const r = await get(a);
        expect(r.status).toBe(200);
        expect(r.body.data.docs.map((m) => m.id)).toEqual([mov3.id, mov1.id, mov2.id]);
    });

    it('MOV-GET-05 filtro rebanhoId', async () => {
        const outroPasto = await criarPasto(propriedadeA.id);
        const outroRebanho = await criarRebanho(propriedadeA.id, outroPasto.id);
        const outroDestino = await criarPasto(propriedadeA.id);

        await registrarMovimentacao(a, { rebanhoId: rebanhoA.id, pastoDestinoId: pastoDestinoA.id });
        await registrarMovimentacao(a, { rebanhoId: outroRebanho.id, pastoDestinoId: outroDestino.id });

        const r = await get(a, `?rebanhoId=${rebanhoA.id}`);
        expect(r.status).toBe(200);
        expect(r.body.data.docs).toHaveLength(1);
        expect(r.body.data.docs[0].rebanhoId).toBe(rebanhoA.id);
    });

    it('MOV-GET-06 filtro propriedadeId', async () => {
        const outraPropriedade = await criarPropriedade(a.id);
        const outroPastoOrigem = await criarPasto(outraPropriedade.id);
        const outroPastoDestino = await criarPasto(outraPropriedade.id);
        const outroRebanho = await criarRebanho(outraPropriedade.id, outroPastoOrigem.id);

        await registrarMovimentacao(a, { rebanhoId: rebanhoA.id, pastoDestinoId: pastoDestinoA.id });
        await registrarMovimentacao(a, { rebanhoId: outroRebanho.id, pastoDestinoId: outroPastoDestino.id });

        const r = await get(a, `?propriedadeId=${propriedadeA.id}`);
        expect(r.status).toBe(200);
        expect(r.body.data.docs).toHaveLength(1);
        expect(r.body.data.docs[0].rebanho.propriedade.id).toBe(propriedadeA.id);
    });

    it('MOV-GET-07 filtro pastoOrigemId', async () => {
        const outroPasto = await criarPasto(propriedadeA.id);
        const outroRebanho = await criarRebanho(propriedadeA.id, outroPasto.id);
        const outroDestino = await criarPasto(propriedadeA.id);

        const mov1 = await registrarMovimentacao(a, { rebanhoId: rebanhoA.id, pastoDestinoId: pastoDestinoA.id });
        await registrarMovimentacao(a, { rebanhoId: outroRebanho.id, pastoDestinoId: outroDestino.id });

        const r = await get(a, `?pastoOrigemId=${pastoOrigemA.id}`);
        expect(r.status).toBe(200);
        expect(r.body.data.docs).toHaveLength(1);
        expect(r.body.data.docs[0].id).toBe(mov1.id);
    });

    it('MOV-GET-08 filtro pastoDestinoId', async () => {
        const outroPasto = await criarPasto(propriedadeA.id);
        const outroRebanho = await criarRebanho(propriedadeA.id, outroPasto.id);
        const outroDestino = await criarPasto(propriedadeA.id);

        const mov1 = await registrarMovimentacao(a, { rebanhoId: rebanhoA.id, pastoDestinoId: pastoDestinoA.id });
        await registrarMovimentacao(a, { rebanhoId: outroRebanho.id, pastoDestinoId: outroDestino.id });

        const r = await get(a, `?pastoDestinoId=${pastoDestinoA.id}`);
        expect(r.status).toBe(200);
        expect(r.body.data.docs).toHaveLength(1);
        expect(r.body.data.docs[0].id).toBe(mov1.id);
    });

    it('MOV-GET-09 filtro dataInicio/dataFim', async () => {
        const pastoB = await criarPasto(propriedadeA.id);
        await registrarMovimentacao(a, {
            rebanhoId: rebanhoA.id,
            pastoDestinoId: pastoDestinoA.id,
            dataMovimentacao: '2026-01-01T00:00:00.000Z',
        });
        const mov2 = await registrarMovimentacao(a, {
            rebanhoId: rebanhoA.id,
            pastoDestinoId: pastoB.id,
            dataMovimentacao: '2026-06-01T00:00:00.000Z',
        });

        const r = await get(a, '?dataInicio=2026-05-01T00:00:00.000Z&dataFim=2026-07-01T00:00:00.000Z');
        expect(r.status).toBe(200);
        expect(r.body.data.docs).toHaveLength(1);
        expect(r.body.data.docs[0].id).toBe(mov2.id);
    });

    it('MOV-GET-10 ativo=false traz só as desfeitas', async () => {
        const mov1 = await registrarMovimentacao(a, { rebanhoId: rebanhoA.id, pastoDestinoId: pastoDestinoA.id });
        await api().delete(`/v1/rebanhos/movimentacoes/${mov1.id}`).set('Authorization', a.bearer);

        const outroPasto = await criarPasto(propriedadeA.id);
        const outroRebanho = await criarRebanho(propriedadeA.id, outroPasto.id);
        const outroDestino = await criarPasto(propriedadeA.id);
        await registrarMovimentacao(a, { rebanhoId: outroRebanho.id, pastoDestinoId: outroDestino.id });

        const r = await get(a, '?ativo=false');
        expect(r.status).toBe(200);
        expect(r.body.data.docs.length).toBeGreaterThan(0);
        expect(r.body.data.docs.every((m) => m.ativo === false)).toBe(true);
        expect(r.body.data.docs.some((m) => m.id === mov1.id)).toBe(true);
    });

    it('MOV-GET-11 atualizadoDesde (delta) traz vigentes e desfeitas juntas', async () => {
        const marco = new Date();
        await new Promise((resolve) => setTimeout(resolve, 10));

        const vigente = await registrarMovimentacao(a, { rebanhoId: rebanhoA.id, pastoDestinoId: pastoDestinoA.id });
        const outroPasto = await criarPasto(propriedadeA.id);
        const outroRebanho = await criarRebanho(propriedadeA.id, outroPasto.id);
        const outroDestino = await criarPasto(propriedadeA.id);
        const desfeita = await registrarMovimentacao(a, { rebanhoId: outroRebanho.id, pastoDestinoId: outroDestino.id });
        await api().delete(`/v1/rebanhos/movimentacoes/${desfeita.id}`).set('Authorization', a.bearer);

        const r = await get(a, `?atualizadoDesde=${marco.toISOString()}`);
        expect(r.status).toBe(200);
        const ids = r.body.data.docs.map((m) => m.id);
        expect(ids).toEqual(expect.arrayContaining([vigente.id, desfeita.id]));
        for (const doc of r.body.data.docs) {
            expect(doc.ativo).toBeDefined();
            expect(doc.updatedAt).toBeDefined();
        }
    });

    it('MOV-GET-12 paginação', async () => {
        const pastoB = await criarPasto(propriedadeA.id);
        const pastoC = await criarPasto(propriedadeA.id);
        await registrarMovimentacao(a, { rebanhoId: rebanhoA.id, pastoDestinoId: pastoDestinoA.id });
        await registrarMovimentacao(a, { rebanhoId: rebanhoA.id, pastoDestinoId: pastoB.id });
        await registrarMovimentacao(a, { rebanhoId: rebanhoA.id, pastoDestinoId: pastoC.id });

        const r = await get(a, '?limit=2');
        expect(r.status).toBe(200);
        expect(r.body.data.docs.length).toBe(2);
    });

    it('MOV-GET-13 limit acima de 100', async () => {
        const r = await get(a, '?limit=101');
        expect(r.status).toBe(400);
        expect(r.body.tipo).toBe('validationError');
    });

    it('MOV-GET-14 query com campo extra', async () => {
        const r = await get(a, '?extra=1');
        expect(r.status).toBe(400);
        expect(r.body.tipo).toBe('validationError');
    });

    it('MOV-GET-15 sem token', async () => {
        const r = await api().get('/v1/rebanhos/movimentacoes');
        expect(r.status).toBe(401);
        expect(r.body.tipo).toBe('unauthorized');
    });

    it('MOV-GET-16 admin (não dono) lista', async () => {
        await registrarMovimentacao(a, { rebanhoId: rebanhoA.id, pastoDestinoId: pastoDestinoA.id });

        const b = await criarUsuario();
        const propriedadeB = await criarPropriedade(b.id);
        const pastoOrigemB = await criarPasto(propriedadeB.id);
        const pastoDestinoB = await criarPasto(propriedadeB.id);
        const rebanhoB = await criarRebanho(propriedadeB.id, pastoOrigemB.id);
        const movB = await registrarMovimentacao(b, { rebanhoId: rebanhoB.id, pastoDestinoId: pastoDestinoB.id });

        const admin = await criarUsuario({ admin: true });
        const r = await get(admin);
        expect(r.status).toBe(200);
        const ids = r.body.data.docs.map((m) => m.id);
        expect(ids).not.toContain(movB.id);
    });

    it('MOV-GET-17 multi-tenancy: B não vê movimentações de A', async () => {
        await registrarMovimentacao(a, { rebanhoId: rebanhoA.id, pastoDestinoId: pastoDestinoA.id });
        const b = await criarUsuario();

        const r = await get(b);
        expect(r.status).toBe(200);
        expect(r.body.data.docs).toEqual([]);
    });
});
