import { beforeEach, describe, expect, it } from 'vitest';
import DbConnect from '../../../src/config/dbConnect.js';
import { api } from '../../apoio/cliente.js';
import { criarUsuario } from '../../apoio/auth.js';
import { criarPropriedade } from '../../apoio/fabricas.js';

describe('GET /v1/propriedades', () => {
    let a;
    beforeEach(async () => { a = await criarUsuario(); });

    const get = (usuario, query = '') =>
        api().get(`/v1/propriedades${query}`).set('Authorization', usuario.bearer);

    it('PROP-GET-01 usuário sem nenhuma propriedade cadastrada', async () => {
        const r = await get(a);
        expect(r.status).toBe(200);
        expect(r.body.message).toBe('Nenhuma propriedade cadastrada.');
        expect(r.body.data.docs).toEqual([]);
        expect(r.body.data.totalDocs).toBe(0);
    });

    it('PROP-GET-02 lista propriedades do usuário autenticado', async () => {
        await criarPropriedade(a.id, { nome: 'Sítio Alegre' });
        await criarPropriedade(a.id, { nome: 'Fazenda Boa Vista' });
        const r = await get(a);
        expect(r.status).toBe(200);
        expect(r.body.data.docs.length).toBe(2);
        expect(r.body.data.docs.map((p) => p.nome)).toEqual(['Fazenda Boa Vista', 'Sítio Alegre']);
        expect(r.body.message).toBe('2 propriedade(s) encontrada(s).');
    });

    it('PROP-GET-03 filtro nome (substring, case-insensitive)', async () => {
        await criarPropriedade(a.id, { nome: 'Fazenda Boa Vista' });
        await criarPropriedade(a.id, { nome: 'Sítio Alegre' });
        const r = await get(a, '?nome=boa');
        expect(r.status).toBe(200);
        expect(r.body.data.docs.length).toBe(1);
        expect(r.body.data.docs[0].nome).toBe('Fazenda Boa Vista');
    });

    it('PROP-GET-04 filtro localizacao (substring, case-insensitive)', async () => {
        await criarPropriedade(a.id, { nome: 'Fazenda A', localizacao: 'Vilhena,RO' });
        await criarPropriedade(a.id, { nome: 'Fazenda B', localizacao: 'Cacoal,RO' });
        const r = await get(a, '?localizacao=vilhena');
        expect(r.status).toBe(200);
        expect(r.body.data.docs.length).toBe(1);
        expect(r.body.data.docs[0].nome).toBe('Fazenda A');
    });

    it('PROP-GET-05 filtros sem nenhum resultado', async () => {
        await criarPropriedade(a.id, { nome: 'Fazenda A' });
        const r = await get(a, '?nome=inexistente');
        expect(r.status).toBe(200);
        expect(r.body.message).toBe('Nenhuma propriedade encontrada com os filtros informados.');
    });

    it('PROP-GET-06 paginação page=2', async () => {
        for (let i = 0; i < 15; i += 1) {
            await criarPropriedade(a.id, { nome: `Fazenda ${String(i).padStart(2, '0')}` });
        }
        const r = await get(a, '?page=2');
        expect(r.status).toBe(200);
        expect(r.body.data.docs.length).toBe(5);
        expect(r.body.data.page).toBe(2);
        expect(r.body.data.totalPages).toBe(2);
    });

    it('PROP-GET-07 limit acima de 100 responde 400 (Zod rejeita antes do truncamento do service)', async () => {
        const r = await get(a, '?limit=500');
        expect(r.status).toBe(400);
        expect(r.body.tipo).toBe('validationError');
        expect(r.body.errors[0].path).toBe('limit');
    });

    it('PROP-GET-08 ?ativo=false não filtra nada (divergência conhecida)', async () => {
        await criarPropriedade(a.id, { nome: 'Ativa' });
        await criarPropriedade(a.id, { nome: 'Inativa', ativo: false });
        const r = await get(a, '?ativo=false');
        expect(r.status).toBe(200);
        expect(r.body.data.docs.length).toBe(1);
        expect(r.body.data.docs[0].nome).toBe('Ativa');
    });

    it('PROP-GET-09 multi-tenancy: B não vê propriedades de A', async () => {
        const b = await criarUsuario();
        await criarPropriedade(a.id, { nome: 'Fazenda de A' });
        await criarPropriedade(b.id, { nome: 'Fazenda de B' });
        const r = await get(b);
        expect(r.status).toBe(200);
        expect(r.body.data.docs.some((p) => p.nome === 'Fazenda de A')).toBe(false);
    });

    it('PROP-GET-10 leitura por diferença: atualizadoDesde traz também as inativas', async () => {
        const marca = new Date().toISOString();
        const propriedade = await criarPropriedade(a.id, { nome: 'Excluída' });
        await DbConnect.prisma.propriedade.update({ where: { id: propriedade.id }, data: { ativo: false } });
        const r = await get(a, `?atualizadoDesde=${marca}`);
        expect(r.status).toBe(200);
        const encontrada = r.body.data.docs.find((p) => p.id === propriedade.id);
        expect(encontrada).toBeDefined();
        expect(encontrada.ativo).toBe(false);
    });

    it('PROP-GET-11 limit ou page inválidos (ex.: page=0, limit=-1)', async () => {
        const r = await get(a, '?page=0');
        expect(r.status).toBe(400);
        expect(r.body.errors[0].path).toBe('page');

        const r2 = await get(a, '?limit=-1');
        expect(r2.status).toBe(400);
        expect(r2.body.errors[0].path).toBe('limit');
    });

    it('PROP-GET-12 atualizadoDesde fora do formato ISO 8601', async () => {
        const r = await get(a, '?atualizadoDesde=ontem');
        expect(r.status).toBe(400);
        expect(r.body.errors[0].path).toBe('atualizadoDesde');
    });

    it('PROP-GET-13 sem token', async () => {
        const r = await api().get('/v1/propriedades');
        expect(r.status).toBe(401);
        expect(r.body.tipo).toBe('unauthorized');
    });
});
