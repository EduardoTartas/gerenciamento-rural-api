import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import DbConnect from '../../../src/config/dbConnect.js';
import { api } from '../../apoio/cliente.js';
import { criarUsuario } from '../../apoio/auth.js';
import { criarPropriedade, criarPasto, criarRebanho } from '../../apoio/fabricas.js';
import { registrarMovimentacao } from './apoio-local.js';

describe('DELETE /v1/rebanhos/movimentacoes/:id', () => {
    let a, propriedadeA, pastoOrigemA, pastoDestinoA, rebanhoA;

    beforeEach(async () => {
        a = await criarUsuario();
        propriedadeA = await criarPropriedade(a.id);
        pastoOrigemA = await criarPasto(propriedadeA.id, { status: 'Ocupado' });
        pastoDestinoA = await criarPasto(propriedadeA.id, { status: 'Vazio' });
        rebanhoA = await criarRebanho(propriedadeA.id, pastoOrigemA.id);
    });

    const del = (usuario, id) =>
        api().delete(`/v1/rebanhos/movimentacoes/${id}`).set('Authorization', usuario.bearer);

    const getPasto = (usuario, id) =>
        api().get(`/v1/pastagens/${id}`).set('Authorization', usuario.bearer);

    it('MOV-DELETE-ID-01 desfaz a última movimentação do rebanho', async () => {
        const mov = await registrarMovimentacao(a, {
            rebanhoId: rebanhoA.id,
            pastoDestinoId: pastoDestinoA.id,
            dataMovimentacao: '2026-01-10T00:00:00.000Z',
        });

        const r = await del(a, mov.id);
        expect(r.status).toBe(200);
        expect(r.body.message).toBe('Movimentação desfeita com sucesso.');

        const movSalva = await DbConnect.prisma.historicoMovimentacao.findUnique({ where: { id: mov.id } });
        expect(movSalva.ativo).toBe(false);

        const rebanhoSalvo = await DbConnect.prisma.rebanho.findUnique({ where: { id: rebanhoA.id } });
        expect(rebanhoSalvo.pastoAtualId).toBe(pastoOrigemA.id);
        expect(rebanhoSalvo.dataEntradaPastoAtual.toISOString()).toBe('2026-01-10T00:00:00.000Z');
    });

    it('MOV-DELETE-ID-02 tenta desfazer uma movimentação que não é a última', async () => {
        const mov1 = await registrarMovimentacao(a, { rebanhoId: rebanhoA.id, pastoDestinoId: pastoDestinoA.id });
        const pastoC = await criarPasto(propriedadeA.id);
        const mov2 = await registrarMovimentacao(a, { rebanhoId: rebanhoA.id, pastoDestinoId: pastoC.id });

        const r = await del(a, mov1.id);
        expect(r.status).toBe(409);
        expect(r.body.tipo).toBe('conflict');
        expect(r.body.errors[0].path).toBe('id');
        expect(r.body.errors[0].message).toContain(mov2.id);
    });

    // Cenário corrigido em relação à linha original do .md — ver seção
    // Divergências: o pasto de origem sempre GANHA um ocupante na reversão
    // (o rebanho volta pra lá), nunca fica vazio por causa dela.
    it('MOV-DELETE-ID-03 pasto de origem volta a ficar ocupado após a reversão', async () => {
        const mov = await registrarMovimentacao(a, { rebanhoId: rebanhoA.id, pastoDestinoId: pastoDestinoA.id });

        const origemAntes = await getPasto(a, pastoOrigemA.id);
        expect(origemAntes.body.data.status).toBe('Descanso');

        const r = await del(a, mov.id);
        expect(r.status).toBe(200);

        const origemDepois = await getPasto(a, pastoOrigemA.id);
        expect(origemDepois.body.data.status).toBe('Ocupado');
    });

    it('MOV-DELETE-ID-04 pasto de origem continua ocupado após a reversão', async () => {
        await criarRebanho(propriedadeA.id, pastoOrigemA.id);
        const mov = await registrarMovimentacao(a, { rebanhoId: rebanhoA.id, pastoDestinoId: pastoDestinoA.id });

        const r = await del(a, mov.id);
        expect(r.status).toBe(200);

        const origemDepois = await getPasto(a, pastoOrigemA.id);
        expect(origemDepois.body.data.status).toBe('Ocupado');
    });

    it('MOV-DELETE-ID-05 pasto de destino fica sem rebanhos ativos após a reversão', async () => {
        const mov = await registrarMovimentacao(a, { rebanhoId: rebanhoA.id, pastoDestinoId: pastoDestinoA.id });

        const r = await del(a, mov.id);
        expect(r.status).toBe(200);

        const destinoDepois = await getPasto(a, pastoDestinoA.id);
        expect(destinoDepois.body.data.status).toBe('Descanso');
        expect(destinoDepois.body.data.dataUltimaSaida).not.toBeNull();
    });

    it('MOV-DELETE-ID-06 pasto de destino continua ocupado após a reversão', async () => {
        const mov = await registrarMovimentacao(a, { rebanhoId: rebanhoA.id, pastoDestinoId: pastoDestinoA.id });

        const outroRebanho = await criarRebanho(propriedadeA.id, pastoOrigemA.id);
        await registrarMovimentacao(a, {
            rebanhoId: outroRebanho.id,
            pastoDestinoId: pastoDestinoA.id,
            permitirLotacaoConjunta: true,
        });

        const r = await del(a, mov.id);
        expect(r.status).toBe(200);

        const destinoDepois = await getPasto(a, pastoDestinoA.id);
        expect(destinoDepois.body.data.status).toBe('Ocupado');
    });

    it('MOV-DELETE-ID-07 id não é UUID', async () => {
        const r = await del(a, 'nao-e-uuid');
        expect(r.status).toBe(400);
        expect(r.body.tipo).toBe('validationError');
    });

    it('MOV-DELETE-ID-08 id inexistente', async () => {
        const r = await del(a, randomUUID());
        expect(r.status).toBe(404);
        expect(r.body.tipo).toBe('resourceNotFound');
    });

    it('MOV-DELETE-ID-09 sem token', async () => {
        const mov = await registrarMovimentacao(a, { rebanhoId: rebanhoA.id, pastoDestinoId: pastoDestinoA.id });
        const r = await api().delete(`/v1/rebanhos/movimentacoes/${mov.id}`);
        expect(r.status).toBe(401);
        expect(r.body.tipo).toBe('unauthorized');
    });

    it('MOV-DELETE-ID-10 multi-tenancy: B tenta desfazer movimentação de A', async () => {
        const mov = await registrarMovimentacao(a, { rebanhoId: rebanhoA.id, pastoDestinoId: pastoDestinoA.id });
        const b = await criarUsuario();

        const r = await del(b, mov.id);
        expect(r.status).toBe(404);
        expect(r.body.tipo).toBe('resourceNotFound');

        const movSalva = await DbConnect.prisma.historicoMovimentacao.findUnique({ where: { id: mov.id } });
        expect(movSalva.ativo).toBe(true);
    });

    it('MOV-DELETE-ID-11 admin (não dono) tenta desfazer movimentação de A', async () => {
        const mov = await registrarMovimentacao(a, { rebanhoId: rebanhoA.id, pastoDestinoId: pastoDestinoA.id });
        const admin = await criarUsuario({ admin: true });

        const r = await del(admin, mov.id);
        expect(r.status).toBe(404);
        expect(r.body.tipo).toBe('resourceNotFound');
    });
});
