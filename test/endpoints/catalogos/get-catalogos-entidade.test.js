import { beforeEach, describe, expect, it } from 'vitest';
import { api } from '../../apoio/cliente.js';
import { criarUsuario } from '../../apoio/auth.js';
import { criarRaca } from '../../apoio/fabricas.js';

describe('GET /v1/catalogos/:entidade', () => {
    let a;

    beforeEach(async () => {
        a = await criarUsuario();
    });

    const get = (usuario, entidade = 'racas', query = '') =>
        api().get(`/v1/catalogos/${entidade}${query}`).set('Authorization', usuario.bearer);

    it('CAT-GET-01 lista itens ativos de racas', async () => {
        await criarRaca({ nome: 'Nelore' });
        const r = await get(a);
        expect(r.status).toBe(200);
        expect(r.body.errors).toEqual([]);
        expect(r.body.message).toBe('1 item(ns) encontrado(s).');
        expect(r.body.data.docs).toHaveLength(1);
        const [item] = r.body.data.docs;
        expect(item).toMatchObject({ nome: 'Nelore', ativo: true });
        expect(item.id).toBeDefined();
        expect(item.createdAt).toBeDefined();
        expect(item.updatedAt).toBeDefined();
    });

    it('CAT-GET-02 lista vazia quando não há itens', async () => {
        const r = await get(a);
        expect(r.status).toBe(200);
        expect(r.body.data.totalDocs).toBe(0);
        expect(r.body.message).toBe('Nenhum item encontrado neste catálogo.');
    });

    it('CAT-GET-03 filtra por nome (contém, case-insensitive)', async () => {
        await criarRaca({ nome: 'Nelore' });
        await criarRaca({ nome: 'Angus' });
        const r = await get(a, 'racas', '?nome=nelo');
        expect(r.status).toBe(200);
        expect(r.body.data.docs).toHaveLength(1);
        expect(r.body.data.docs[0].nome).toBe('Nelore');
    });

    it('CAT-GET-04 filtra por ativo=false', async () => {
        await criarRaca({ nome: 'Nelore Ativa' });
        await criarRaca({ nome: 'Nelore Inativa', ativo: false });
        const r = await get(a, 'racas', '?ativo=false');
        expect(r.status).toBe(200);
        expect(r.body.data.docs).toHaveLength(1);
        expect(r.body.data.docs[0].nome).toBe('Nelore Inativa');
        expect(r.body.data.docs[0].ativo).toBe(false);
    });

    it('CAT-GET-05 pagina com page/limit', async () => {
        for (let i = 0; i < 11; i += 1) {
            await criarRaca({ nome: `Raça ${String(i).padStart(2, '0')}` });
        }
        const r = await get(a, 'racas', '?page=2&limit=5');
        expect(r.status).toBe(200);
        expect(r.body.data.limit).toBe(5);
        expect(r.body.data.page).toBe(2);
        expect(r.body.data.totalPages).toBe(3);
        expect(r.body.data.docs.length).toBeLessThanOrEqual(5);
    });

    it('CAT-GET-06 limit acima de 100 é rejeitado pelo schema', async () => {
        const r = await get(a, 'racas', '?limit=500');
        expect(r.status).toBe(400);
        expect(r.body.errors.some((e) => e.path === 'limit')).toBe(true);
    });

    // CAT-GET-07: CatalogoQuerySchema usa `errorMap` (sintaxe Zod v3) para customizar a
    // mensagem de `ativo` inválido, mas no Zod v4 essa opção chama-se `error` — `errorMap`
    // é ignorado e a mensagem padrão do Zod é devolvida em vez da customizada. Ver Divergências.
    it.fails('CAT-GET-07 ativo com valor fora de true/false', async () => {
        const r = await get(a, 'racas', '?ativo=talvez');
        expect(r.status).toBe(400);
        expect(r.body.errors.some((e) => e.message === "O filtro 'ativo' deve ser 'true' ou 'false'")).toBe(true);
    });

    it('CAT-GET-08 campo de query não reconhecido (.strict())', async () => {
        const r = await get(a, 'racas', '?foo=bar');
        expect(r.status).toBe(400);
        expect(r.body.tipo).toBe('validationError');
        // Zod v4: issue `unrecognized_keys` chega com path: [] — o campo aparece na mensagem.
        expect(r.body.errors[0].path).toBe('');
        expect(r.body.errors[0].message).toContain('foo');
    });

    it('CAT-GET-09 :entidade inexistente', async () => {
        const r = await get(a, 'nao-existe');
        expect(r.status).toBe(404);
        expect(r.body.tipo).toBe('resourceNotFound');
        expect(r.body.message).toContain('racas');
        expect(r.body.message).toContain('sistemas-producao');
    });

    it('CAT-GET-10 401 sem token', async () => {
        const r = await api().get('/v1/catalogos/racas');
        expect(r.status).toBe(401);
        expect(r.body.tipo).toBe('unauthorized');
        expect(r.body.recuperavel).toBe(true);
    });

    it('CAT-GET-11 leitura não exige admin', async () => {
        await criarRaca({ nome: 'Nelore' });
        const r = await get(a);
        expect(r.status).toBe(200);
        expect(r.body.data.docs).toHaveLength(1);
    });

    it('CAT-TENANCY-01 item criado por admin é visível para A e para B', async () => {
        const raca = await criarRaca({ nome: 'Nelore' });
        const b = await criarUsuario();

        const rA = await get(a);
        const rB = await get(b);
        expect(rA.status).toBe(200);
        expect(rB.status).toBe(200);
        expect(rA.body.data.docs.map((item) => item.id)).toContain(raca.id);
        expect(rB.body.data.docs.map((item) => item.id)).toContain(raca.id);
    });
});
