import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import DbConnect from '../../../src/config/dbConnect.js';
import { api } from '../../apoio/cliente.js';
import { criarUsuario } from '../../apoio/auth.js';
import { criarPropriedade, criarPasto, criarRebanho } from '../../apoio/fabricas.js';

describe('DELETE /v1/propriedades/:id', () => {
    let a;
    beforeEach(async () => { a = await criarUsuario(); });

    const del = (usuario, id) =>
        api().delete(`/v1/propriedades/${id}`).set('Authorization', usuario.bearer);

    it('PROP-DELETE-ID-01 exclui (soft-delete) propriedade sem rebanhos ativos', async () => {
        const propriedade = await criarPropriedade(a.id);
        const r = await del(a, propriedade.id);
        expect(r.status).toBe(200);
        expect(r.body.message).toBe('Propriedade excluída com sucesso.');
        const salvo = await DbConnect.prisma.propriedade.findUnique({ where: { id: propriedade.id } });
        expect(salvo.ativo).toBe(false);
    });

    it('PROP-DELETE-ID-02 recusa exclusão com rebanhos ativos na propriedade', async () => {
        const propriedade = await criarPropriedade(a.id);
        const pasto = await criarPasto(propriedade.id);
        await criarRebanho(propriedade.id, pasto.id);
        const r = await del(a, propriedade.id);
        expect(r.status).toBe(400);
        expect(r.body.tipo).toBe('validationError');
        expect(r.body.errors[0].path).toBe('ativo');
    });

    it('PROP-DELETE-ID-03 id inexistente', async () => {
        const r = await del(a, randomUUID());
        expect(r.status).toBe(404);
        expect(r.body.tipo).toBe('resourceNotFound');
    });

    it('PROP-DELETE-ID-04 multi-tenancy: B tenta excluir propriedade de A', async () => {
        const b = await criarUsuario();
        const propriedade = await criarPropriedade(a.id);
        const r = await del(b, propriedade.id);
        expect(r.status).toBe(404);
        expect(r.body.tipo).toBe('resourceNotFound');
        const salvo = await DbConnect.prisma.propriedade.findUnique({ where: { id: propriedade.id } });
        expect(salvo.ativo).toBe(true);
    });

    it('PROP-DELETE-ID-05 :id não é UUID válido', async () => {
        const r = await del(a, 'nao-uuid');
        expect(r.status).toBe(400);
    });

    it('PROP-DELETE-ID-06 excluir propriedade já inativa', async () => {
        const propriedade = await criarPropriedade(a.id, { ativo: false });
        const r = await del(a, propriedade.id);
        expect(r.status).toBe(200);
        const salvo = await DbConnect.prisma.propriedade.findUnique({ where: { id: propriedade.id } });
        expect(salvo.ativo).toBe(false);
    });

    it('PROP-DELETE-ID-07 sem token', async () => {
        const propriedade = await criarPropriedade(a.id);
        const r = await api().delete(`/v1/propriedades/${propriedade.id}`);
        expect(r.status).toBe(401);
        expect(r.body.tipo).toBe('unauthorized');
    });
});
