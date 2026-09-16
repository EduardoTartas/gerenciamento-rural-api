import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import DbConnect from '../../../src/config/dbConnect.js';
import { api } from '../../apoio/cliente.js';
import { criarUsuario } from '../../apoio/auth.js';
import { criarPropriedade, criarPasto, criarRebanho } from '../../apoio/fabricas.js';

describe('DELETE /v1/rebanhos/:id', () => {
    let a;
    let propriedade;
    let pasto;

    beforeEach(async () => {
        a = await criarUsuario();
        propriedade = await criarPropriedade(a.id);
        pasto = await criarPasto(propriedade.id, { status: 'Ocupado' });
    });

    const del = (usuario, id) =>
        api().delete(`/v1/rebanhos/${id}`).set('Authorization', usuario.bearer);

    // Bug: RebanhoService._inativar usa `executor` fora de escopo
    // (src/service/RebanhoService.js:187) -> ReferenceError -> 500. Comportamento
    // correto esperado é 200 com soft-delete efetivo (ver Divergências no .md).
    it.fails('REB-DELETE-ID-01 inativa rebanho ativo de A', async () => {
        const rebanho = await criarRebanho(propriedade.id, pasto.id);
        const r = await del(a, rebanho.id);
        expect(r.status).toBe(200);
        expect(r.body.data.ativo).toBe(false);
        expect(r.body.data.pastoAtualId).toBeNull();
        const salvo = await DbConnect.prisma.rebanho.findUnique({ where: { id: rebanho.id } });
        expect(salvo.ativo).toBe(false);
        expect(salvo.pastoAtualId).toBeNull();
        const pastoSalvo = await DbConnect.prisma.pasto.findUnique({ where: { id: pasto.id } });
        expect(pastoSalvo.status).toBe('Descanso');
    });

    it('REB-DELETE-ID-02 id não é UUID', async () => {
        const r = await del(a, 'nao-uuid');
        expect(r.status).toBe(400);
    });

    it('REB-DELETE-ID-03 id inexistente', async () => {
        const r = await del(a, randomUUID());
        expect(r.status).toBe(404);
        expect(r.body.tipo).toBe('resourceNotFound');
    });

    it('REB-DELETE-ID-04 sem token', async () => {
        const rebanho = await criarRebanho(propriedade.id, pasto.id);
        const r = await api().delete(`/v1/rebanhos/${rebanho.id}`);
        expect(r.status).toBe(401);
        expect(r.body.tipo).toBe('unauthorized');
    });

    it('REB-DELETE-ID-05 multi-tenancy: B tenta remover rebanho de A', async () => {
        const rebanho = await criarRebanho(propriedade.id, pasto.id);
        const b = await criarUsuario();
        const r = await del(b, rebanho.id);
        expect(r.status).toBe(404);
        expect(r.body.tipo).toBe('resourceNotFound');
        const salvo = await DbConnect.prisma.rebanho.findUnique({ where: { id: rebanho.id } });
        expect(salvo.ativo).toBe(true);
    });

    it('REB-DELETE-ID-06 admin (não dono) tenta remover rebanho de A', async () => {
        const rebanho = await criarRebanho(propriedade.id, pasto.id);
        const admin = await criarUsuario({ admin: true });
        const r = await del(admin, rebanho.id);
        expect(r.status).toBe(404);
        expect(r.body.tipo).toBe('resourceNotFound');
    });
});
