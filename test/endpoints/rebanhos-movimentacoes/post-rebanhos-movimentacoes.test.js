import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import DbConnect from '../../../src/config/dbConnect.js';
import { api } from '../../apoio/cliente.js';
import { criarUsuario } from '../../apoio/auth.js';
import { criarPropriedade, criarPasto, criarRebanho } from '../../apoio/fabricas.js';

describe('POST /v1/rebanhos/movimentacoes', () => {
    let a, propriedadeA, pastoOrigemA, pastoDestinoA, rebanhoA;

    beforeEach(async () => {
        a = await criarUsuario();
        propriedadeA = await criarPropriedade(a.id);
        pastoOrigemA = await criarPasto(propriedadeA.id, { status: 'Ocupado' });
        pastoDestinoA = await criarPasto(propriedadeA.id, { status: 'Vazio' });
        rebanhoA = await criarRebanho(propriedadeA.id, pastoOrigemA.id);
    });

    const post = (usuario, corpo) =>
        api().post('/v1/rebanhos/movimentacoes').set('Authorization', usuario.bearer).send(corpo);

    const corpoBase = (extra = {}) => ({
        rebanhoId: rebanhoA.id,
        pastoDestinoId: pastoDestinoA.id,
        ...extra,
    });

    it('MOV-POST-01 registra movimentação válida', async () => {
        const r = await post(a, corpoBase());
        expect(r.status).toBe(201);
        expect(r.body.errors).toEqual([]);
        expect(r.body.data.pastoOrigemId).toBe(pastoOrigemA.id);
        expect(r.body.data.pastoDestinoId).toBe(pastoDestinoA.id);

        const salvo = await DbConnect.prisma.historicoMovimentacao.findUnique({ where: { id: r.body.data.id } });
        expect(salvo.rebanhoId).toBe(rebanhoA.id);
    });

    it('MOV-POST-02 aceita id gerado pelo cliente (offline-first)', async () => {
        const id = randomUUID();
        const r = await post(a, corpoBase({ id }));
        expect(r.status).toBe(201);
        expect(r.body.data.id).toBe(id);
    });

    it('MOV-POST-03 corpo vazio', async () => {
        const r = await post(a, {});
        expect(r.status).toBe(400);
        expect(r.body.errors[0].path).toBe('body');
    });

    it('MOV-POST-04 campo extra no corpo (.strict())', async () => {
        const r = await post(a, corpoBase({ extra: 1 }));
        expect(r.status).toBe(400);
        expect(r.body.tipo).toBe('validationError');
    });

    it('MOV-POST-05 falta rebanhoId', async () => {
        const { rebanhoId, ...corpo } = corpoBase();
        const r = await post(a, corpo);
        expect(r.status).toBe(400);
        expect(r.body.tipo).toBe('validationError');
    });

    it('MOV-POST-06 falta pastoDestinoId', async () => {
        const { pastoDestinoId, ...corpo } = corpoBase();
        const r = await post(a, corpo);
        expect(r.status).toBe(400);
        expect(r.body.tipo).toBe('validationError');
    });

    it('MOV-POST-07 dataMovimentacao no futuro', async () => {
        const r = await post(a, corpoBase({ dataMovimentacao: '2999-01-01T00:00:00.000Z' }));
        expect(r.status).toBe(400);
        expect(r.body.errors[0].message).toContain('não pode ser no futuro');
    });

    it('MOV-POST-08 sem token', async () => {
        const r = await api().post('/v1/rebanhos/movimentacoes').send(corpoBase());
        expect(r.status).toBe(401);
        expect(r.body.tipo).toBe('unauthorized');
    });

    it('MOV-POST-09 admin (não dono) tenta mover rebanho de A', async () => {
        const admin = await criarUsuario({ admin: true });
        const r = await post(admin, corpoBase());
        expect(r.status).toBe(404);
        expect(r.body.tipo).toBe('resourceNotFound');
    });

    it('MOV-POST-10 B tenta mover rebanho de A (rebanhoId de A)', async () => {
        const b = await criarUsuario();
        const r = await post(b, corpoBase());
        expect(r.status).toBe(404);
        expect(r.body.tipo).toBe('resourceNotFound');
    });

    it('MOV-POST-11 rebanhoId inexistente', async () => {
        const r = await post(a, corpoBase({ rebanhoId: randomUUID() }));
        expect(r.status).toBe(404);
        expect(r.body.tipo).toBe('resourceNotFound');
    });

    it('MOV-POST-12 rebanho inativo', async () => {
        const rebanhoInativo = await criarRebanho(propriedadeA.id, pastoOrigemA.id, { ativo: false });
        const r = await post(a, corpoBase({ rebanhoId: rebanhoInativo.id }));
        expect(r.status).toBe(400);
        expect(r.body.errors[0].path).toBe('rebanhoId');
        expect(r.body.message).toContain('Rebanho está inativo');
    });

    it('MOV-POST-13 pastoDestinoId inexistente', async () => {
        const r = await post(a, corpoBase({ pastoDestinoId: randomUUID() }));
        expect(r.status).toBe(404);
        expect(r.body.tipo).toBe('resourceNotFound');
    });

    it('MOV-POST-14 pastoDestinoId pertence a B', async () => {
        const b = await criarUsuario();
        const propriedadeB = await criarPropriedade(b.id);
        const pastoB = await criarPasto(propriedadeB.id);

        const r = await post(a, corpoBase({ pastoDestinoId: pastoB.id }));
        expect(r.status).toBe(404);
        expect(r.body.tipo).toBe('resourceNotFound');
    });

    it('MOV-POST-15 pasto de destino inativo', async () => {
        const pastoInativo = await criarPasto(propriedadeA.id, { ativo: false });
        const r = await post(a, corpoBase({ pastoDestinoId: pastoInativo.id }));
        expect(r.status).toBe(400);
        expect(r.body.errors[0].path).toBe('pastoDestinoId');
        expect(r.body.message).toContain('Pasto de destino está inativo');
    });

    it('MOV-POST-16 destino igual ao pasto atual do rebanho', async () => {
        const r = await post(a, corpoBase({ pastoDestinoId: pastoOrigemA.id }));
        expect(r.status).toBe(400);
        expect(r.body.errors[0].path).toBe('pastoDestinoId');
        expect(r.body.message).toContain('já está neste pasto');
    });

    it('MOV-POST-17 destino de propriedade diferente da do rebanho', async () => {
        const outraPropriedade = await criarPropriedade(a.id);
        const pastoOutraPropriedade = await criarPasto(outraPropriedade.id);

        const r = await post(a, corpoBase({ pastoDestinoId: pastoOutraPropriedade.id }));
        expect(r.status).toBe(400);
        expect(r.body.errors[0].path).toBe('pastoDestinoId');
        expect(r.body.errors[0].message).toContain('não pertence à mesma propriedade');
    });

    it('MOV-POST-18 destino ocupado por outro rebanho ativo, sem permitirLotacaoConjunta', async () => {
        await criarRebanho(propriedadeA.id, pastoDestinoA.id);

        const r = await post(a, corpoBase());
        expect(r.status).toBe(400);
        expect(r.body.errors[0].path).toBe('pastoDestinoId');
        expect(r.body.errors[0].message).toContain('já tem outro lote');
    });

    it('MOV-POST-19 destino ocupado, com permitirLotacaoConjunta: true', async () => {
        const outroRebanho = await criarRebanho(propriedadeA.id, pastoDestinoA.id);

        const r = await post(a, corpoBase({ permitirLotacaoConjunta: true }));
        expect(r.status).toBe(201);

        const ativosNoDestino = await DbConnect.prisma.rebanho.findMany({
            where: { pastoAtualId: pastoDestinoA.id, ativo: true },
        });
        const ids = ativosNoDestino.map((rb) => rb.id);
        expect(ids).toEqual(expect.arrayContaining([rebanhoA.id, outroRebanho.id]));
    });

    it('MOV-POST-20 destino em status Descanso não bloqueia', async () => {
        const pastoDescanso = await criarPasto(propriedadeA.id, {
            status: 'Descanso',
            dataUltimaSaida: new Date(),
        });

        const r = await post(a, corpoBase({ pastoDestinoId: pastoDescanso.id }));
        expect(r.status).toBe(201);
    });

    it('MOV-POST-21 transação: atualiza rebanho.pastoAtualId e dataEntradaPastoAtual', async () => {
        const dataMovimentacao = '2026-01-05T00:00:00.000Z';
        const r = await post(a, corpoBase({ dataMovimentacao }));
        expect(r.status).toBe(201);

        const getR = await api().get(`/v1/rebanhos/${rebanhoA.id}`).set('Authorization', a.bearer);
        expect(getR.body.data.pastoAtualId).toBe(pastoDestinoA.id);
        expect(new Date(getR.body.data.dataEntradaPastoAtual).toISOString()).toBe(dataMovimentacao);
    });

    it('MOV-POST-22 transação: pasto de destino vira Ocupado', async () => {
        const r = await post(a, corpoBase());
        expect(r.status).toBe(201);

        const getR = await api().get(`/v1/pastagens/${pastoDestinoA.id}`).set('Authorization', a.bearer);
        expect(getR.body.data.status).toBe('Ocupado');
    });

    it('MOV-POST-23 transação: pasto de origem esvazia', async () => {
        const r = await post(a, corpoBase());
        expect(r.status).toBe(201);

        const getR = await api().get(`/v1/pastagens/${pastoOrigemA.id}`).set('Authorization', a.bearer);
        expect(getR.body.data.status).toBe('Descanso');
        expect(getR.body.data.dataUltimaSaida).not.toBeNull();
    });

    it('MOV-POST-24 transação: pasto de origem não esvazia', async () => {
        await criarRebanho(propriedadeA.id, pastoOrigemA.id);

        const r = await post(a, corpoBase());
        expect(r.status).toBe(201);

        const getR = await api().get(`/v1/pastagens/${pastoOrigemA.id}`).set('Authorization', a.bearer);
        expect(getR.body.data.status).toBe('Ocupado');
        expect(getR.body.data.dataUltimaSaida).toBeNull();
    });
});
