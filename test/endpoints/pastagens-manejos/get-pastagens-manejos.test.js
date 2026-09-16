import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { api } from '../../apoio/cliente.js';
import { criarUsuario } from '../../apoio/auth.js';
import { criarPropriedade, criarPasto, criarTipoManejoPasto } from '../../apoio/fabricas.js';
import { criarManejoPasto } from './apoio-local.js';

describe('GET /v1/pastagens/manejos', () => {
    let a, propriedade, pasto, tipoManejo;

    beforeEach(async () => {
        a = await criarUsuario();
        propriedade = await criarPropriedade(a.id);
        pasto = await criarPasto(propriedade.id);
        tipoManejo = await criarTipoManejoPasto();
    });

    const get = (usuario, query = '') =>
        api().get(`/v1/pastagens/manejos${query}`).set('Authorization', usuario.bearer);

    it('MPAS-GET-01 usuário sem nenhum manejo cadastrado', async () => {
        const r = await get(a);
        expect(r.status).toBe(200);
        expect(r.body.message).toBe('Nenhum manejo de pasto cadastrado.');
        expect(r.body.data.docs).toEqual([]);
    });

    it('MPAS-GET-02 lista manejos do usuário autenticado', async () => {
        await criarManejoPasto(pasto.id, tipoManejo.id, { dataAtividade: new Date('2026-01-01T00:00:00Z') });
        await criarManejoPasto(pasto.id, tipoManejo.id, { dataAtividade: new Date('2026-01-05T00:00:00Z') });

        const r = await get(a);
        expect(r.status).toBe(200);
        expect(r.body.data.docs.length).toBe(2);
        expect(new Date(r.body.data.docs[0].dataAtividade).getTime())
            .toBeGreaterThan(new Date(r.body.data.docs[1].dataAtividade).getTime());
        expect(r.body.data.docs[0].tipoManejo).toMatchObject({ id: tipoManejo.id, nome: tipoManejo.nome });
        expect(r.body.data.docs[0].pasto).toMatchObject({
            id: pasto.id,
            nome: pasto.nome,
            propriedade: { id: propriedade.id, nome: propriedade.nome },
        });
        expect(r.body.data.docs[0].itens).toEqual([]);
    });

    it('MPAS-GET-03 filtro pastoId', async () => {
        const outroPasto = await criarPasto(propriedade.id);
        await criarManejoPasto(pasto.id, tipoManejo.id);
        await criarManejoPasto(outroPasto.id, tipoManejo.id);

        const r = await get(a, `?pastoId=${pasto.id}`);
        expect(r.status).toBe(200);
        expect(r.body.data.docs).toHaveLength(1);
        expect(r.body.data.docs[0].pastoId).toBe(pasto.id);
    });

    it('MPAS-GET-04 filtro propriedadeId', async () => {
        const outraPropriedade = await criarPropriedade(a.id);
        const outroPasto = await criarPasto(outraPropriedade.id);
        await criarManejoPasto(pasto.id, tipoManejo.id);
        await criarManejoPasto(outroPasto.id, tipoManejo.id);

        const r = await get(a, `?propriedadeId=${propriedade.id}`);
        expect(r.status).toBe(200);
        expect(r.body.data.docs).toHaveLength(1);
        expect(r.body.data.docs[0].pasto.propriedade.id).toBe(propriedade.id);
    });

    it('MPAS-GET-05 filtro tipoManejoId', async () => {
        const outroTipo = await criarTipoManejoPasto();
        await criarManejoPasto(pasto.id, tipoManejo.id);
        await criarManejoPasto(pasto.id, outroTipo.id);

        const r = await get(a, `?tipoManejoId=${tipoManejo.id}`);
        expect(r.status).toBe(200);
        expect(r.body.data.docs).toHaveLength(1);
        expect(r.body.data.docs[0].tipoManejoId).toBe(tipoManejo.id);
    });

    it('MPAS-GET-06 filtro dataInicio/dataFim', async () => {
        await criarManejoPasto(pasto.id, tipoManejo.id, { dataAtividade: new Date('2026-01-01T00:00:00Z') });
        await criarManejoPasto(pasto.id, tipoManejo.id, { dataAtividade: new Date('2026-06-01T00:00:00Z') });

        const r = await get(a, '?dataInicio=2026-05-01T00:00:00.000Z&dataFim=2026-07-01T00:00:00.000Z');
        expect(r.status).toBe(200);
        expect(r.body.data.docs).toHaveLength(1);
        expect(new Date(r.body.data.docs[0].dataAtividade).toISOString()).toBe('2026-06-01T00:00:00.000Z');
    });

    it('MPAS-GET-07 filtros sem nenhum resultado', async () => {
        const r = await get(a, `?pastoId=${randomUUID()}`);
        expect(r.status).toBe(200);
        expect(r.body.message).toBe('Nenhum manejo de pasto encontrado com os filtros informados.');
    });

    it('MPAS-GET-08 paginação page=2', async () => {
        for (let i = 0; i < 15; i += 1) {
            await criarManejoPasto(pasto.id, tipoManejo.id, { dataAtividade: new Date(2026, 0, i + 1) });
        }

        const r = await get(a, '?page=2');
        expect(r.status).toBe(200);
        expect(r.body.data.page).toBe(2);
    });

    it('MPAS-GET-09 limit acima de 100 é recusado', async () => {
        const r = await get(a, '?limit=500');
        expect(r.status).toBe(400);
        expect(r.body.tipo).toBe('validationError');
        expect(r.body.errors[0].path).toBe('limit');
    });

    it('MPAS-GET-10 ?ativo=false filtra só os manejos excluídos', async () => {
        await criarManejoPasto(pasto.id, tipoManejo.id);
        await criarManejoPasto(pasto.id, tipoManejo.id, { ativo: false });

        const r = await get(a, '?ativo=false');
        expect(r.status).toBe(200);
        expect(r.body.data.docs).toHaveLength(1);
        expect(r.body.data.docs.every((m) => m.ativo === false)).toBe(true);
    });

    it('MPAS-GET-11 multi-tenancy: B não vê manejos de pastos de A', async () => {
        await criarManejoPasto(pasto.id, tipoManejo.id);
        const b = await criarUsuario();

        const r = await get(b);
        expect(r.status).toBe(200);
        expect(r.body.data.docs).toEqual([]);
    });

    it('MPAS-GET-12 leitura por diferença: atualizadoDesde traz vigentes e excluídos juntos', async () => {
        const marco = new Date();
        await new Promise((resolve) => setTimeout(resolve, 10));
        const excluido = await criarManejoPasto(pasto.id, tipoManejo.id, { ativo: false });

        const r = await get(a, `?atualizadoDesde=${marco.toISOString()}`);
        expect(r.status).toBe(200);
        const doc = r.body.data.docs.find((m) => m.id === excluido.id);
        expect(doc).toBeDefined();
        expect(doc.ativo).toBe(false);
        expect(doc.updatedAt).toBeDefined();
    });

    it('MPAS-GET-13 query inválida (dataInicio malformada)', async () => {
        const r = await get(a, '?dataInicio=nao-e-data');
        expect(r.status).toBe(400);
        expect(r.body.errors[0].path).toBe('dataInicio');
    });

    it('MPAS-GET-14 sem token', async () => {
        const r = await api().get('/v1/pastagens/manejos');
        expect(r.status).toBe(401);
        expect(r.body.tipo).toBe('unauthorized');
    });
});
