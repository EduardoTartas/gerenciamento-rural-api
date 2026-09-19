import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import DbConnect from '../../../src/config/dbConnect.js';
import { api } from '../../apoio/cliente.js';
import { criarUsuario } from '../../apoio/auth.js';
import { criarPropriedade, criarPasto, criarRebanho } from '../../apoio/fabricas.js';

describe('DELETE /v1/pastagens/:id', () => {
    let a;
    let propriedade;

    beforeEach(async () => {
        a = await criarUsuario();
        propriedade = await criarPropriedade(a.id);
    });

    const del = (usuario, id) =>
        api().delete(`/v1/pastagens/${id}`).set('Authorization', usuario.bearer);

    it('PAST-DELETE-ID-01 exclui (soft-delete) pasto sem rebanhos', async () => {
        const pasto = await criarPasto(propriedade.id);
        const r = await del(a, pasto.id);
        expect(r.status).toBe(200);
        const salvo = await DbConnect.prisma.pasto.findUnique({ where: { id: pasto.id } });
        expect(salvo.ativo).toBe(false);
    });

    it('PAST-DELETE-ID-02 recusa exclusão com rebanho ativo no pasto', async () => {
        const pasto = await criarPasto(propriedade.id, { status: 'Ocupado' });
        await criarRebanho(propriedade.id, pasto.id);
        const r = await del(a, pasto.id);
        expect(r.status).toBe(400);
        expect(r.body.tipo).toBe('validationError');
        expect(r.body.errors[0].path).toBe('ativo');
        const salvo = await DbConnect.prisma.pasto.findUnique({ where: { id: pasto.id } });
        expect(salvo.ativo).toBe(true);
    });

    it('PAST-DELETE-ID-03 id inexistente', async () => {
        const r = await del(a, randomUUID());
        expect(r.status).toBe(404);
        expect(r.body.tipo).toBe('resourceNotFound');
    });

    it('PAST-DELETE-ID-04 multi-tenancy: B tenta excluir pasto de A', async () => {
        const pasto = await criarPasto(propriedade.id);
        const b = await criarUsuario();
        const r = await del(b, pasto.id);
        expect(r.status).toBe(404);
        expect(r.body.tipo).toBe('resourceNotFound');
        const salvo = await DbConnect.prisma.pasto.findUnique({ where: { id: pasto.id } });
        expect(salvo.ativo).toBe(true);
    });

    it('PAST-DELETE-ID-05 :id não é UUID válido', async () => {
        const r = await del(a, 'nao-uuid');
        expect(r.status).toBe(400);
        expect(r.body.errors[0].message).toBe('ID de pastagem inválido. Deve ser um UUID válido.');
    });

    it('PAST-DELETE-ID-06 sem token', async () => {
        const pasto = await criarPasto(propriedade.id);
        const r = await api().delete(`/v1/pastagens/${pasto.id}`);
        expect(r.status).toBe(401);
        expect(r.body.tipo).toBe('unauthorized');
    });
});
