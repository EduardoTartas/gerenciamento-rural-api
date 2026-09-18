import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import DbConnect from '../../../src/config/dbConnect.js';
import { api } from '../../apoio/cliente.js';
import { criarUsuario } from '../../apoio/auth.js';

describe('PATCH /v1/usuarios/:id', () => {
    let a;
    beforeEach(async () => { a = await criarUsuario(); });

    const patch = (usuario, id, corpo) =>
        api().patch(`/v1/usuarios/${id}`).set('Authorization', usuario.bearer).send(corpo);

    it('USR-PATCH-01 usuário atualiza o próprio name', async () => {
        const r = await patch(a, a.id, { name: 'Novo Nome' });
        expect(r.status).toBe(200);
        expect(r.body.data.name).toBe('Novo Nome');
        expect(r.body.message).toBe('Usuário atualizado com sucesso.');
        const salvo = await DbConnect.prisma.user.findUnique({ where: { id: a.id } });
        expect(salvo.name).toBe('Novo Nome');
    });

    it('USR-PATCH-02 usuário atualiza o próprio email para um e-mail livre', async () => {
        const novoEmail = `novo-${randomUUID()}@pastolivre.test`;
        const r = await patch(a, a.id, { email: novoEmail });
        expect(r.status).toBe(200);
        expect(r.body.data.email).toBe(novoEmail);
        const salvo = await DbConnect.prisma.user.findUnique({ where: { id: a.id } });
        expect(salvo.email).toBe(novoEmail);
    });

    it('USR-PATCH-03 usuário atualiza image para uma URL', async () => {
        const r = await patch(a, a.id, { image: 'https://exemplo.test/foto.jpg' });
        expect(r.status).toBe(200);
        expect(r.body.data.image).toBe('https://exemplo.test/foto.jpg');
    });

    it('USR-PATCH-04 usuário limpa image (null)', async () => {
        await patch(a, a.id, { image: 'https://exemplo.test/foto.jpg' });
        const r = await patch(a, a.id, { image: null });
        expect(r.status).toBe(200);
        expect(r.body.data.image).toBeNull();
        const salvo = await DbConnect.prisma.user.findUnique({ where: { id: a.id } });
        expect(salvo.image).toBeNull();
    });

    it('USR-PATCH-05 corpo vazio', async () => {
        const r = await patch(a, a.id, {});
        expect(r.status).toBe(400);
        expect(r.body.message).toBe('Por favor, informe pelo menos um campo para atualizar.');
    });

    it('USR-PATCH-06 campo extra no corpo (.strict())', async () => {
        const r = await patch(a, a.id, { name: 'Nome Válido', admin: true });
        expect(r.status).toBe(400);
        expect(r.body.tipo).toBe('validationError');
        const salvo = await DbConnect.prisma.user.findUnique({ where: { id: a.id } });
        expect(salvo.admin).toBe(false);
    });

    it('USR-PATCH-07 email em formato inválido', async () => {
        const r = await patch(a, a.id, { email: 'não-é-email' });
        expect(r.status).toBe(400);
        expect(r.body.errors[0].message).toBe('Formato de e-mail inválido.');
    });

    it('USR-PATCH-08 image que não é URL válida', async () => {
        const r = await patch(a, a.id, { image: 'not-a-url' });
        expect(r.status).toBe(400);
        expect(r.body.errors[0].message).toBe('A imagem deve ser uma URL válida.');
    });

    it('USR-PATCH-09 email já em uso por outro usuário', async () => {
        const b = await criarUsuario();
        const r = await patch(a, a.id, { email: b.email });
        expect(r.status).toBe(409);
        expect(r.body.tipo).toBe('conflict');
        expect(r.body.message).toBe('E-mail já cadastrado.');
    });

    it('USR-PATCH-10 usuário comum tenta atualizar outro usuário', async () => {
        const b = await criarUsuario();
        const r = await patch(a, b.id, { name: 'Invasão' });
        expect(r.status).toBe(403);
        expect(r.body.tipo).toBe('forbidden');
        expect(r.body.message).toBe('Você não tem permissão para atualizar o perfil de outro usuário.');
        const salvo = await DbConnect.prisma.user.findUnique({ where: { id: b.id } });
        expect(salvo.name).toBe('Produtor Teste');
    });

    it('USR-PATCH-11 admin atualiza outro usuário (bypass)', async () => {
        const admin = await criarUsuario({ admin: true });
        const r = await patch(admin, a.id, { name: 'Editado pelo Admin' });
        expect(r.status).toBe(200);
        const salvo = await DbConnect.prisma.user.findUnique({ where: { id: a.id } });
        expect(salvo.name).toBe('Editado pelo Admin');
    });

    it('USR-PATCH-12 ID em formato inválido', async () => {
        const r = await patch(a, 'abc', { name: 'Nome Válido' });
        expect(r.status).toBe(400);
        expect(r.body.tipo).toBe('validationError');
    });

    it('USR-PATCH-13 UUID válido mas inexistente', async () => {
        const r = await patch(a, randomUUID(), { name: 'Nome Válido' });
        expect(r.status).toBe(404);
        expect(r.body.tipo).toBe('resourceNotFound');
    });

    it('USR-PATCH-14 401 sem token', async () => {
        const r = await api().patch(`/v1/usuarios/${a.id}`).send({ name: 'Nome Válido' });
        expect(r.status).toBe(401);
        expect(r.body.tipo).toBe('unauthorized');
    });
});
