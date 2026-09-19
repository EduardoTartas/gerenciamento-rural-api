import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { api } from '../../apoio/cliente.js';
import { criarUsuario } from '../../apoio/auth.js';
import { criarPropriedade, criarPasto, criarRebanho } from '../../apoio/fabricas.js';
import { registrarMovimentacao } from './apoio-local.js';

describe('GET /v1/rebanhos/movimentacoes/:id', () => {
    let a, propriedadeA, pastoOrigemA, pastoDestinoA, rebanhoA, movimentacaoA;

    beforeEach(async () => {
        a = await criarUsuario();
        propriedadeA = await criarPropriedade(a.id);
        pastoOrigemA = await criarPasto(propriedadeA.id);
        pastoDestinoA = await criarPasto(propriedadeA.id);
        rebanhoA = await criarRebanho(propriedadeA.id, pastoOrigemA.id);
        movimentacaoA = await registrarMovimentacao(a, { rebanhoId: rebanhoA.id, pastoDestinoId: pastoDestinoA.id });
    });

    const get = (usuario, id) =>
        api().get(`/v1/rebanhos/movimentacoes/${id}`).set('Authorization', usuario.bearer);

    it('MOV-GET-ID-01 busca movimentação de A', async () => {
        const r = await get(a, movimentacaoA.id);
        expect(r.status).toBe(200);
        expect(r.body.data.id).toBe(movimentacaoA.id);
        expect(r.body.data.rebanho.id).toBe(rebanhoA.id);
        expect(r.body.data.pastoOrigem.id).toBe(pastoOrigemA.id);
        expect(r.body.data.pastoDestino.id).toBe(pastoDestinoA.id);
    });

    it('MOV-GET-ID-02 id não é UUID', async () => {
        const r = await get(a, 'nao-e-uuid');
        expect(r.status).toBe(400);
        expect(r.body.tipo).toBe('validationError');
    });

    it('MOV-GET-ID-03 id inexistente', async () => {
        const r = await get(a, randomUUID());
        expect(r.status).toBe(404);
        expect(r.body.tipo).toBe('resourceNotFound');
    });

    it('MOV-GET-ID-04 sem token', async () => {
        const r = await api().get(`/v1/rebanhos/movimentacoes/${movimentacaoA.id}`);
        expect(r.status).toBe(401);
        expect(r.body.tipo).toBe('unauthorized');
    });

    it('MOV-GET-ID-05 multi-tenancy: B busca movimentação de A', async () => {
        const b = await criarUsuario();
        const r = await get(b, movimentacaoA.id);
        expect(r.status).toBe(404);
        expect(r.body.tipo).toBe('resourceNotFound');
    });

    it('MOV-GET-ID-06 admin (não dono) busca movimentação de A', async () => {
        const admin = await criarUsuario({ admin: true });
        const r = await get(admin, movimentacaoA.id);
        expect(r.status).toBe(404);
        expect(r.body.tipo).toBe('resourceNotFound');
    });
});
