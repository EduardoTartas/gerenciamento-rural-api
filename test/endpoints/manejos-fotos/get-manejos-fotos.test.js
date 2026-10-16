import { beforeEach, describe, expect, it } from 'vitest';
import { api } from '../../apoio/cliente.js';
import { criarUsuario } from '../../apoio/auth.js';
import { criarCenario, criarFoto } from './apoio-local.js';

describe('GET /v1/manejos/fotos', () => {
    let a, cenario;

    beforeEach(async () => {
        a = await criarUsuario();
        cenario = await criarCenario(a.id);
    });

    const listar = (usuario, query = {}) =>
        api().get('/v1/manejos/fotos').query(query).set('Authorization', usuario.bearer);

    it('FOTO-GET-01 lista as fotos ativas do usuário, das duas atividades', async () => {
        await criarFoto({ manejoPastoId: cenario.manejoPasto.id });
        await criarFoto({ manejoRebanhoId: cenario.manejoRebanho.id });
        await criarFoto({ manejoPastoId: cenario.manejoPasto.id, ativo: false });

        const r = await listar(a);
        expect(r.status).toBe(200);
        expect(r.body.message).toBe('2 foto(s) encontrada(s).');
        expect(r.body.data).toMatchObject({ totalDocs: 2, page: 1, limit: 10, totalPages: 1 });
        expect(r.body.data.docs).toHaveLength(2);
        expect(Object.keys(r.body.data.docs[0]).sort()).toEqual(
            ['ativo', 'createdAt', 'id', 'manejoPastoId', 'manejoRebanhoId', 'updatedAt', 'url'],
        );
    });

    it('FOTO-GET-02 sem fotos', async () => {
        const r = await listar(a);
        expect(r.status).toBe(200);
        expect(r.body.message).toBe('Nenhuma foto encontrada.');
        expect(r.body.data.docs).toEqual([]);
    });

    it('FOTO-GET-03 ordena por createdAt crescente', async () => {
        const nova = await criarFoto({ manejoPastoId: cenario.manejoPasto.id, createdAt: new Date('2026-05-02T00:00:00Z') });
        const antiga = await criarFoto({ manejoPastoId: cenario.manejoPasto.id, createdAt: new Date('2026-05-01T00:00:00Z') });

        const r = await listar(a);
        expect(r.body.data.docs.map((f) => f.id)).toEqual([antiga.id, nova.id]);
    });

    it('FOTO-GET-04 filtra por manejoPastoId e manejoRebanhoId', async () => {
        const fp = await criarFoto({ manejoPastoId: cenario.manejoPasto.id });
        const fr = await criarFoto({ manejoRebanhoId: cenario.manejoRebanho.id });

        const rp = await listar(a, { manejoPastoId: cenario.manejoPasto.id });
        expect(rp.body.data.docs.map((f) => f.id)).toEqual([fp.id]);

        const rr = await listar(a, { manejoRebanhoId: cenario.manejoRebanho.id });
        expect(rr.body.data.docs.map((f) => f.id)).toEqual([fr.id]);
    });

    it('FOTO-GET-05 filtra por pastoId, rebanhoId e propriedadeId', async () => {
        const fp = await criarFoto({ manejoPastoId: cenario.manejoPasto.id });
        const fr = await criarFoto({ manejoRebanhoId: cenario.manejoRebanho.id });
        const outro = await criarCenario(a.id);
        await criarFoto({ manejoPastoId: outro.manejoPasto.id });

        const porPasto = await listar(a, { pastoId: cenario.pasto.id });
        expect(porPasto.body.data.docs.map((f) => f.id)).toEqual([fp.id]);

        const porRebanho = await listar(a, { rebanhoId: cenario.rebanho.id });
        expect(porRebanho.body.data.docs.map((f) => f.id)).toEqual([fr.id]);

        const porPropriedade = await listar(a, { propriedadeId: cenario.propriedade.id });
        expect(porPropriedade.body.data.docs.map((f) => f.id).sort()).toEqual([fp.id, fr.id].sort());
    });

    it('FOTO-GET-06 atualizadoDesde devolve também as excluídas', async () => {
        const marca = new Date(Date.now() - 60_000);
        const viva = await criarFoto({ manejoPastoId: cenario.manejoPasto.id });
        const excluida = await criarFoto({ manejoPastoId: cenario.manejoPasto.id, ativo: false });
        // Mexida antes da marca: não volta.
        await criarFoto({ manejoPastoId: cenario.manejoPasto.id, updatedAt: new Date('2020-01-01T00:00:00Z') });

        const r = await listar(a, { atualizadoDesde: marca.toISOString() });
        expect(r.status).toBe(200);
        const porId = Object.fromEntries(r.body.data.docs.map((f) => [f.id, f]));
        expect(Object.keys(porId).sort()).toEqual([viva.id, excluida.id].sort());
        expect(porId[excluida.id].ativo).toBe(false);
    });

    it('FOTO-GET-07 ativo=false lista só as excluídas', async () => {
        await criarFoto({ manejoPastoId: cenario.manejoPasto.id });
        const excluida = await criarFoto({ manejoPastoId: cenario.manejoPasto.id, ativo: false });

        const r = await listar(a, { ativo: 'false' });
        expect(r.body.data.docs.map((f) => f.id)).toEqual([excluida.id]);
    });

    it('FOTO-GET-08 multi-tenancy: B não vê fotos de A, nem filtrando pelo manejo de A', async () => {
        await criarFoto({ manejoPastoId: cenario.manejoPasto.id });
        await criarFoto({ manejoRebanhoId: cenario.manejoRebanho.id });
        const b = await criarUsuario();

        const r = await listar(b);
        expect(r.body.data.docs).toEqual([]);

        const filtrado = await listar(b, { manejoPastoId: cenario.manejoPasto.id });
        expect(filtrado.body.data.docs).toEqual([]);
    });

    it('FOTO-GET-09 paginação', async () => {
        for (let i = 0; i < 3; i++) await criarFoto({ manejoPastoId: cenario.manejoPasto.id });

        const r = await listar(a, { page: 2, limit: 2 });
        expect(r.body.data).toMatchObject({ totalDocs: 3, page: 2, limit: 2, totalPages: 2 });
        expect(r.body.data.docs).toHaveLength(1);
    });

    it('FOTO-GET-10 limit acima de 100', async () => {
        const r = await listar(a, { limit: 101 });
        expect(r.status).toBe(400);
        expect(r.body.tipo).toBe('validationError');
    });

    it('FOTO-GET-11 filtro desconhecido', async () => {
        const r = await listar(a, { qualquer: 'x' });
        expect(r.status).toBe(400);
    });

    it('FOTO-GET-12 atualizadoDesde inválido', async () => {
        const r = await listar(a, { atualizadoDesde: 'ontem' });
        expect(r.status).toBe(400);
        expect(r.body.errors[0].message).toBe('atualizadoDesde deve ser uma data ISO 8601 em UTC.');
    });

    it('FOTO-GET-13 sem token', async () => {
        const r = await api().get('/v1/manejos/fotos');
        expect(r.status).toBe(401);
        expect(r.body.tipo).toBe('unauthorized');
    });
});
