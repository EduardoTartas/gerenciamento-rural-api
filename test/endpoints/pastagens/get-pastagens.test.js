import { beforeEach, describe, expect, it } from 'vitest';
import { api } from '../../apoio/cliente.js';
import { criarUsuario } from '../../apoio/auth.js';
import { criarPropriedade, criarPasto } from '../../apoio/fabricas.js';

describe('GET /v1/pastagens', () => {
    let a;
    let propriedade;

    beforeEach(async () => {
        a = await criarUsuario();
        propriedade = await criarPropriedade(a.id);
    });

    const get = (usuario, query = '') =>
        api().get(`/v1/pastagens${query}`).set('Authorization', usuario.bearer);

    it('PAST-GET-01 usuário sem nenhum pasto cadastrado', async () => {
        const r = await get(a);
        expect(r.status).toBe(200);
        expect(r.body.message).toBe('Nenhuma pastagem cadastrada.');
        expect(r.body.data.docs).toEqual([]);
    });

    it('PAST-GET-02 lista pastos do usuário autenticado', async () => {
        await criarPasto(propriedade.id, { nome: 'Piquete B' });
        await criarPasto(propriedade.id, { nome: 'Piquete A' });
        const r = await get(a);
        expect(r.status).toBe(200);
        expect(r.body.data.docs).toHaveLength(2);
        expect(r.body.data.docs.map((p) => p.nome)).toEqual(['Piquete A', 'Piquete B']);
        expect(r.body.data.docs[0].propriedade).toMatchObject({ id: propriedade.id, nome: propriedade.nome });
    });

    it('PAST-GET-03 filtro nome (substring, case-insensitive)', async () => {
        await criarPasto(propriedade.id, { nome: 'Piquete Norte' });
        await criarPasto(propriedade.id, { nome: 'Piquete Sul' });
        const r = await get(a, '?nome=norte');
        expect(r.status).toBe(200);
        expect(r.body.data.docs).toHaveLength(1);
        expect(r.body.data.docs[0].nome).toBe('Piquete Norte');
    });

    it('PAST-GET-04 filtro propriedadeId', async () => {
        const outraPropriedade = await criarPropriedade(a.id);
        await criarPasto(propriedade.id, { nome: 'Piquete 1' });
        await criarPasto(outraPropriedade.id, { nome: 'Piquete 2' });
        const r = await get(a, `?propriedadeId=${propriedade.id}`);
        expect(r.status).toBe(200);
        expect(r.body.data.docs).toHaveLength(1);
        expect(r.body.data.docs[0].propriedadeId).toBe(propriedade.id);
    });

    it('PAST-GET-05 filtro status', async () => {
        await criarPasto(propriedade.id, { nome: 'Piquete Ocupado', status: 'Ocupado' });
        await criarPasto(propriedade.id, { nome: 'Piquete Vazio', status: 'Vazio' });
        const r = await get(a, '?status=Ocupado');
        expect(r.status).toBe(200);
        expect(r.body.data.docs).toHaveLength(1);
        expect(r.body.data.docs[0].status).toBe('Ocupado');
    });

    it('PAST-GET-06 filtro tipoPastagem (substring, case-insensitive)', async () => {
        await criarPasto(propriedade.id, { nome: 'Piquete 1', tipoPastagem: 'Braquiária' });
        await criarPasto(propriedade.id, { nome: 'Piquete 2', tipoPastagem: 'Tifton' });
        const r = await get(a, '?tipoPastagem=braqui');
        expect(r.status).toBe(200);
        expect(r.body.data.docs).toHaveLength(1);
        expect(r.body.data.docs[0].tipoPastagem).toBe('Braquiária');
    });

    it('PAST-GET-07 filtros sem nenhum resultado', async () => {
        await criarPasto(propriedade.id, { nome: 'Piquete 1' });
        const r = await get(a, '?nome=inexistente');
        expect(r.status).toBe(200);
        expect(r.body.message).toBe('Nenhuma pastagem encontrada com os filtros informados.');
        expect(r.body.data.docs).toEqual([]);
    });

    it('PAST-GET-08 paginação page=2', async () => {
        for (let i = 0; i < 15; i += 1) {
            await criarPasto(propriedade.id, { nome: `Piquete ${String(i).padStart(2, '0')}` });
        }
        const r = await get(a, '?page=2');
        expect(r.status).toBe(200);
        expect(r.body.data.page).toBe(2);
        expect(r.body.data.docs).toHaveLength(5);
    });

    it('PAST-GET-09 limit acima de 100 é recusado pela query', async () => {
        const r = await get(a, '?limit=500');
        expect(r.status).toBe(400);
        expect(r.body.errors.some((e) => e.path === 'limit')).toBe(true);
    });

    it('PAST-GET-10 ?ativo=false filtra só os pastos inativos', async () => {
        await criarPasto(propriedade.id, { nome: 'Piquete Ativo' });
        await criarPasto(propriedade.id, { nome: 'Piquete Inativo', ativo: false });
        const r = await get(a, '?ativo=false');
        expect(r.status).toBe(200);
        expect(r.body.data.docs).toHaveLength(1);
        expect(r.body.data.docs[0].ativo).toBe(false);
    });

    it('PAST-GET-11 multi-tenancy: B não vê pastos de A', async () => {
        await criarPasto(propriedade.id, { nome: 'Piquete de A' });
        const b = await criarUsuario();
        const r = await get(b);
        expect(r.status).toBe(200);
        expect(r.body.data.docs).toEqual([]);
    });

    it('PAST-GET-12 leitura por diferença: atualizadoDesde traz também os inativos', async () => {
        const marca = new Date().toISOString();
        const pasto = await criarPasto(propriedade.id, { nome: 'Piquete Excluído' });
        const { default: DbConnect } = await import('../../../src/config/dbConnect.js');
        await DbConnect.prisma.pasto.update({ where: { id: pasto.id }, data: { ativo: false } });

        const r = await get(a, `?atualizadoDesde=${marca}`);
        expect(r.status).toBe(200);
        const encontrado = r.body.data.docs.find((p) => p.id === pasto.id);
        expect(encontrado).toBeDefined();
        expect(encontrado.ativo).toBe(false);
        expect(encontrado.updatedAt).toBeDefined();
    });

    it('PAST-GET-13 query inválida (ex.: status=Invalido)', async () => {
        const r = await get(a, '?status=Invalido');
        expect(r.status).toBe(400);
        expect(r.body.errors.some((e) => e.path === 'status')).toBe(true);
    });

    it('PAST-GET-14 sem token', async () => {
        const r = await api().get('/v1/pastagens');
        expect(r.status).toBe(401);
        expect(r.body.tipo).toBe('unauthorized');
    });
});
