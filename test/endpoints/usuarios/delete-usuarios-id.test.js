import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import DbConnect from '../../../src/config/dbConnect.js';
import { api } from '../../apoio/cliente.js';
import { criarUsuario } from '../../apoio/auth.js';
import { criarPropriedade } from '../../apoio/fabricas.js';

describe('DELETE /v1/usuarios/:id', () => {
    const del = (usuario, id) => api().delete(`/v1/usuarios/${id}`).set('Authorization', usuario.bearer);

    it('USR-DELETE-01 usuário exclui a própria conta', async () => {
        const a = await criarUsuario();
        const r = await del(a, a.id);
        expect(r.status).toBe(200);
        expect(r.body.errors).toEqual([]);
        expect(r.body.data).toMatchObject({ id: a.id, name: 'Produtor Teste', email: a.email });
        expect(r.body.message).toBe('Usuário removido com sucesso.');
        const salvo = await DbConnect.prisma.user.findUnique({ where: { id: a.id } });
        expect(salvo).toBeNull();
    });

    it('USR-DELETE-02 sessões do usuário são revogadas antes da exclusão', async () => {
        const a = await criarUsuario();
        const r = await del(a, a.id);
        expect(r.status).toBe(200);

        const sessoes = await DbConnect.prisma.session.findMany({ where: { userId: a.id } });
        expect(sessoes).toHaveLength(0);

        const semAcesso = await api().get(`/v1/usuarios/${a.id}`).set('Authorization', a.bearer);
        expect(semAcesso.status).toBe(401);
    });

    it('USR-DELETE-03 exclusão em cascata remove dados do domínio do usuário', async () => {
        const a = await criarUsuario();
        const propriedade = await criarPropriedade(a.id);
        const r = await del(a, a.id);
        expect(r.status).toBe(200);
        const salvo = await DbConnect.prisma.propriedade.findUnique({ where: { id: propriedade.id } });
        expect(salvo).toBeNull();
    });

    it('USR-DELETE-04 usuário comum tenta excluir outro usuário', async () => {
        const a = await criarUsuario();
        const b = await criarUsuario();
        const r = await del(a, b.id);
        expect(r.status).toBe(403);
        expect(r.body.tipo).toBe('forbidden');
        expect(r.body.message).toBe('Você não tem permissão para excluir a conta de outro usuário.');
        const salvo = await DbConnect.prisma.user.findUnique({ where: { id: b.id } });
        expect(salvo).not.toBeNull();
    });

    it('USR-DELETE-05 admin tenta excluir outro usuário (sem bypass)', async () => {
        const admin = await criarUsuario({ admin: true });
        const a = await criarUsuario();
        const r = await del(admin, a.id);
        expect(r.status).toBe(403);
        expect(r.body.tipo).toBe('forbidden');
        const salvo = await DbConnect.prisma.user.findUnique({ where: { id: a.id } });
        expect(salvo).not.toBeNull();
    });

    it('USR-DELETE-06 ID em formato inválido', async () => {
        const a = await criarUsuario();
        const r = await del(a, 'abc');
        expect(r.status).toBe(400);
        expect(r.body.tipo).toBe('validationError');
    });

    it('USR-DELETE-07 UUID válido mas inexistente', async () => {
        const a = await criarUsuario();
        const r = await del(a, randomUUID());
        expect(r.status).toBe(404);
        expect(r.body.tipo).toBe('resourceNotFound');
    });

    it('USR-DELETE-08 401 sem token', async () => {
        const r = await api().delete(`/v1/usuarios/${randomUUID()}`);
        expect(r.status).toBe(401);
        expect(r.body.tipo).toBe('unauthorized');
    });
});
