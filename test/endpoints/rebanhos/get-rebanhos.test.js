import { beforeEach, describe, expect, it } from 'vitest';
import DbConnect from '../../../src/config/dbConnect.js';
import { api } from '../../apoio/cliente.js';
import { criarUsuario } from '../../apoio/auth.js';
import {
    criarPropriedade, criarPasto, criarRebanho, criarRaca, criarSistemaProducao, criarRegimeAlimentar,
} from '../../apoio/fabricas.js';

describe('GET /v1/rebanhos', () => {
    let a;
    let propriedade;
    let pasto;

    beforeEach(async () => {
        a = await criarUsuario();
        propriedade = await criarPropriedade(a.id);
        pasto = await criarPasto(propriedade.id);
    });

    const get = (usuario, query = '') =>
        api().get(`/v1/rebanhos${query}`).set('Authorization', usuario.bearer);

    it('REB-GET-01 lista rebanhos ativos de A', async () => {
        await criarRebanho(propriedade.id, pasto.id, { nomeRebanho: 'Lote 1' });
        await criarRebanho(propriedade.id, pasto.id, { nomeRebanho: 'Lote 2', pastoAtualId: null });
        const r = await get(a);
        expect(r.status).toBe(200);
        expect(r.body.data.docs).toHaveLength(2);
        expect(r.body.data.totalDocs).toBe(2);
    });

    it('REB-GET-02 usuário sem rebanhos', async () => {
        const r = await get(a);
        expect(r.status).toBe(200);
        expect(r.body.message).toBe('Nenhum rebanho cadastrado.');
        expect(r.body.data.docs).toEqual([]);
    });

    it('REB-GET-03 filtro sem resultado', async () => {
        await criarRebanho(propriedade.id, pasto.id, { nomeRebanho: 'Lote 1' });
        const r = await get(a, '?nomeRebanho=inexistente');
        expect(r.status).toBe(200);
        expect(r.body.message).toBe('Nenhum rebanho encontrado com os filtros informados.');
        expect(r.body.data.docs).toEqual([]);
    });

    it('REB-GET-04 filtro nomeRebanho (contains, case-insensitive)', async () => {
        await criarRebanho(propriedade.id, pasto.id, { nomeRebanho: 'Lote Norte' });
        await criarRebanho(propriedade.id, pasto.id, { nomeRebanho: 'Lote Sul' });
        const r = await get(a, '?nomeRebanho=norte');
        expect(r.status).toBe(200);
        expect(r.body.data.docs).toHaveLength(1);
        expect(r.body.data.docs[0].nomeRebanho).toBe('Lote Norte');
    });

    it('REB-GET-05 filtro propriedadeId', async () => {
        const outraPropriedade = await criarPropriedade(a.id);
        const outroPasto = await criarPasto(outraPropriedade.id);
        await criarRebanho(propriedade.id, pasto.id, { nomeRebanho: 'Lote 1' });
        await criarRebanho(outraPropriedade.id, outroPasto.id, { nomeRebanho: 'Lote 2' });
        const r = await get(a, `?propriedadeId=${propriedade.id}`);
        expect(r.status).toBe(200);
        expect(r.body.data.docs).toHaveLength(1);
        expect(r.body.data.docs[0].propriedadeId).toBe(propriedade.id);
    });

    it('REB-GET-06 filtro pastoAtualId', async () => {
        const outroPasto = await criarPasto(propriedade.id);
        await criarRebanho(propriedade.id, pasto.id, { nomeRebanho: 'Lote 1' });
        await criarRebanho(propriedade.id, outroPasto.id, { nomeRebanho: 'Lote 2' });
        const r = await get(a, `?pastoAtualId=${pasto.id}`);
        expect(r.status).toBe(200);
        expect(r.body.data.docs).toHaveLength(1);
        expect(r.body.data.docs[0].pastoAtualId).toBe(pasto.id);
    });

    it('REB-GET-07 filtro racaId', async () => {
        const raca = await criarRaca();
        await criarRebanho(propriedade.id, pasto.id, { nomeRebanho: 'Lote 1', racaId: raca.id });
        await criarRebanho(propriedade.id, pasto.id, { nomeRebanho: 'Lote 2' });
        const r = await get(a, `?racaId=${raca.id}`);
        expect(r.status).toBe(200);
        expect(r.body.data.docs).toHaveLength(1);
        expect(r.body.data.docs[0].racaId).toBe(raca.id);
    });

    it('REB-GET-08 filtro sistemaProducaoId', async () => {
        const sistema = await criarSistemaProducao();
        await criarRebanho(propriedade.id, pasto.id, { nomeRebanho: 'Lote 1', sistemaProducaoId: sistema.id });
        await criarRebanho(propriedade.id, pasto.id, { nomeRebanho: 'Lote 2' });
        const r = await get(a, `?sistemaProducaoId=${sistema.id}`);
        expect(r.status).toBe(200);
        expect(r.body.data.docs).toHaveLength(1);
        expect(r.body.data.docs[0].sistemaProducaoId).toBe(sistema.id);
    });

    it('REB-GET-09 filtro regimeAlimentarId', async () => {
        const regime = await criarRegimeAlimentar();
        await criarRebanho(propriedade.id, pasto.id, { nomeRebanho: 'Lote 1', regimeAlimentarId: regime.id });
        await criarRebanho(propriedade.id, pasto.id, { nomeRebanho: 'Lote 2' });
        const r = await get(a, `?regimeAlimentarId=${regime.id}`);
        expect(r.status).toBe(200);
        expect(r.body.data.docs).toHaveLength(1);
        expect(r.body.data.docs[0].regimeAlimentarId).toBe(regime.id);
    });

    it('REB-GET-10 ativo=false', async () => {
        await criarRebanho(propriedade.id, pasto.id, { nomeRebanho: 'Lote Ativo' });
        await criarRebanho(propriedade.id, pasto.id, { nomeRebanho: 'Lote Inativo', ativo: false, pastoAtualId: null });
        const r = await get(a, '?ativo=false');
        expect(r.status).toBe(200);
        expect(r.body.data.docs).toHaveLength(1);
        expect(r.body.data.docs[0].ativo).toBe(false);
    });

    it('REB-GET-11 atualizadoDesde (delta)', async () => {
        const marca = new Date().toISOString();
        const inativo = await criarRebanho(propriedade.id, pasto.id, { nomeRebanho: 'Lote Excluído' });
        await DbConnect.prisma.rebanho.update({ where: { id: inativo.id }, data: { ativo: false } });
        await criarRebanho(propriedade.id, pasto.id, { nomeRebanho: 'Lote Ativo' });

        const r = await get(a, `?atualizadoDesde=${marca}`);
        expect(r.status).toBe(200);
        expect(r.body.data.docs).toHaveLength(2);
        for (const doc of r.body.data.docs) {
            expect(doc).toHaveProperty('ativo');
            expect(doc).toHaveProperty('updatedAt');
        }
    });

    it('REB-GET-12 paginação (page, limit)', async () => {
        for (let i = 0; i < 3; i += 1) {
            await criarRebanho(propriedade.id, pasto.id, { nomeRebanho: `Lote ${String(i).padStart(2, '0')}` });
        }
        const r = await get(a, '?limit=2');
        expect(r.status).toBe(200);
        expect(r.body.data.docs).toHaveLength(2);
        expect(r.body.data.totalPages).toBe(2);
    });

    it('REB-GET-13 limit acima de 100', async () => {
        const r = await get(a, '?limit=101');
        expect(r.status).toBe(400);
        expect(r.body.errors.some((e) => e.path === 'limit')).toBe(true);
    });

    it('REB-GET-14 query com campo extra (.strict())', async () => {
        const r = await get(a, '?extra=1');
        expect(r.status).toBe(400);
        expect(r.body.tipo).toBe('validationError');
    });

    it('REB-GET-15 sem token', async () => {
        const r = await api().get('/v1/rebanhos');
        expect(r.status).toBe(401);
        expect(r.body.tipo).toBe('unauthorized');
    });

    it('REB-GET-16 admin (não dono) lista', async () => {
        await criarRebanho(propriedade.id, pasto.id, { nomeRebanho: 'Lote de A' });
        const admin = await criarUsuario({ admin: true });
        const r = await get(admin);
        expect(r.status).toBe(200);
        expect(r.body.data.docs).toEqual([]);
    });

    it('REB-GET-17 multi-tenancy: B não vê rebanhos de A', async () => {
        await criarRebanho(propriedade.id, pasto.id, { nomeRebanho: 'Lote de A' });
        const b = await criarUsuario();
        const r = await get(b);
        expect(r.status).toBe(200);
        expect(r.body.data.docs).toEqual([]);
    });
});
