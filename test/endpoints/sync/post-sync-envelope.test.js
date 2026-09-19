import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import DbConnect from '../../../src/config/dbConnect.js';
import { api } from '../../apoio/cliente.js';
import { criarUsuario } from '../../apoio/auth.js';
import { criarPropriedade, criarPasto } from '../../apoio/fabricas.js';

describe('POST /v1/sync — envelope', () => {
    let a, propriedade;

    beforeEach(async () => {
        a = await criarUsuario();
        propriedade = await criarPropriedade(a.id);
    });

    const sync = (usuario, mutacoes) =>
        api().post('/v1/sync').set('Authorization', usuario.bearer).send({ mutacoes });

    const mutacaoPasto = (extra = {}) => ({
        id: randomUUID(),
        entidade: 'pastos',
        acao: 'CREATE',
        entidadeId: randomUUID(),
        dados: { propriedadeId: propriedade.id, nome: `Piquete ${randomUUID().slice(0, 6)}` },
        ...extra,
    });

    it('SYNC-POST-01 lote bem formado com uma mutação', async () => {
        const m = mutacaoPasto();
        const r = await sync(a, [m]);
        expect(r.status).toBe(200);
        expect(r.body.errors).toEqual([]);
        expect(r.body.data.resultados).toHaveLength(1);
        expect(r.body.data.resultados[0]).toMatchObject({ id: m.id, situacao: 'aceito' });
    });

    it('SYNC-POST-02 mutacoes vazio', async () => {
        const r = await sync(a, []);
        expect(r.status).toBe(400);
        expect(r.body.tipo).toBe('validationError');
        expect(r.body.errors[0].path).toBe('mutacoes');
        expect(r.body.errors[0].message).toBe('Envie ao menos uma mutação.');
    });

    it('SYNC-POST-03 mais de 100 mutações no lote', async () => {
        const mutacoes = Array.from({ length: 101 }, () => mutacaoPasto());
        const r = await sync(a, mutacoes);
        expect(r.status).toBe(400);
        expect(r.body.errors[0].message).toContain('máximo');
        expect(r.body.errors[0].message).toContain('100');
    });

    it('SYNC-POST-04 acao fora de CREATE/UPDATE/DELETE', async () => {
        const r = await sync(a, [mutacaoPasto({ acao: 'UPSERT' })]);
        expect(r.status).toBe(400);
        expect(r.body.errors[0].message).toBe('A ação deve ser CREATE, UPDATE ou DELETE.');
    });

    it('SYNC-POST-05 id da mutação não é UUID', async () => {
        const r = await sync(a, [mutacaoPasto({ id: 'abc' })]);
        expect(r.status).toBe(400);
        expect(r.body.errors[0].message).toBe('O id da mutação deve ser um UUID válido.');
    });

    it('SYNC-POST-06 entidadeId não é UUID', async () => {
        const r = await sync(a, [mutacaoPasto({ entidadeId: 'abc' })]);
        expect(r.status).toBe(400);
        expect(r.body.errors[0].message).toBe('O id da entidade deve ser um UUID válido.');
    });

    it('SYNC-POST-07 campo extra na mutação (.strict())', async () => {
        const r = await sync(a, [mutacaoPasto({ extra: 1 })]);
        expect(r.status).toBe(400);
        expect(r.body.tipo).toBe('validationError');
    });

    it('SYNC-POST-08 corpo vazio ({})', async () => {
        const r = await api().post('/v1/sync').set('Authorization', a.bearer).send({});
        expect(r.status).toBe(400);
        expect(r.body.tipo).toBe('validationError');
        expect(r.body.errors[0].path).toBe('mutacoes');
    });

    it('SYNC-POST-09 CREATE sem dados', async () => {
        const { dados, ...m } = mutacaoPasto();
        const r = await sync(a, [m]);
        expect(r.status).toBe(400);
        expect(r.body.errors.some((e) => e.message === 'CREATE e UPDATE exigem o campo dados.')).toBe(true);
    });

    it('SYNC-POST-10 UPDATE sem dados', async () => {
        const pasto = await criarPasto(propriedade.id);
        const m = { id: randomUUID(), entidade: 'pastos', acao: 'UPDATE', entidadeId: pasto.id };
        const r = await sync(a, [m]);
        expect(r.status).toBe(400);
        expect(r.body.errors.some((e) => e.message === 'CREATE e UPDATE exigem o campo dados.')).toBe(true);
    });

    it('SYNC-POST-11 DELETE sem dados é aceito pelo envelope', async () => {
        const pasto = await criarPasto(propriedade.id);
        const m = { id: randomUUID(), entidade: 'pastos', acao: 'DELETE', entidadeId: pasto.id };
        const r = await sync(a, [m]);
        expect(r.status).toBe(200);
        expect(r.body.data.resultados[0]).toMatchObject({ id: m.id, situacao: 'aceito' });
    });

    it('SYNC-POST-12 id dentro de dados é recusado', async () => {
        const m = mutacaoPasto();
        m.dados.id = randomUUID();
        const r = await sync(a, [m]);
        expect(r.status).toBe(400);
        expect(r.body.errors.some((e) =>
            e.message === 'O identificador vem em entidadeId; não repita `id` dentro de dados.')).toBe(true);
    });

    it('SYNC-POST-13 dependeDe com formato inválido (não UUID, não nulo)', async () => {
        const r = await sync(a, [mutacaoPasto({ dependeDe: 'abc' })]);
        expect(r.status).toBe(400);
        expect(r.body.errors.some((e) => e.path.endsWith('dependeDe'))).toBe(true);
    });

    it('SYNC-POST-14 falha de envelope recusa a requisição inteira (nenhuma mutação é tentada)', async () => {
        const valida = mutacaoPasto();
        const invalida = mutacaoPasto({ acao: 'UPSERT' });
        const r = await sync(a, [valida, invalida]);
        expect(r.status).toBe(400);

        const aplicadas = await DbConnect.prisma.mutacaoAplicada.count();
        expect(aplicadas).toBe(0);
        const pastos = await DbConnect.prisma.pasto.count({ where: { propriedadeId: propriedade.id } });
        expect(pastos).toBe(0);
    });
});
