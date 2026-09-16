import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import DbConnect from '../../../src/config/dbConnect.js';
import { api } from '../../apoio/cliente.js';
import { criarUsuario } from '../../apoio/auth.js';
import { criarRaca } from '../../apoio/fabricas.js';

describe('PATCH /v1/catalogos/:entidade/:id', () => {
    let admin;
    let a;

    beforeEach(async () => {
        admin = await criarUsuario({ admin: true });
        a = await criarUsuario();
    });

    const patch = (usuario, entidade, id, corpo) =>
        api().patch(`/v1/catalogos/${entidade}/${id}`).set('Authorization', usuario.bearer).send(corpo);

    it('CAT-PATCH-01 admin atualiza nome', async () => {
        const raca = await criarRaca({ nome: 'Nelore' });
        const r = await patch(admin, 'racas', raca.id, { nome: 'Nelore Mocha' });
        expect(r.status).toBe(200);
        expect(r.body.message).toBe('Item de catálogo atualizado com sucesso.');
        expect(r.body.data.nome).toBe('Nelore Mocha');
        const salvo = await DbConnect.prisma.raca.findUnique({ where: { id: raca.id } });
        expect(salvo.nome).toBe('Nelore Mocha');
    });

    it('CAT-PATCH-02 admin reativa item (ativo: true)', async () => {
        const raca = await criarRaca({ nome: 'Nelore', ativo: false });
        const r = await patch(admin, 'racas', raca.id, { ativo: true });
        expect(r.status).toBe(200);
        expect(r.body.data.ativo).toBe(true);
    });

    it('CAT-PATCH-03 admin arquiva via ativo: false', async () => {
        const raca = await criarRaca({ nome: 'Nelore' });
        const r = await patch(admin, 'racas', raca.id, { ativo: false });
        expect(r.status).toBe(200);
        expect(r.body.data.ativo).toBe(false);
    });

    it('CAT-PATCH-04 corpo vazio', async () => {
        const raca = await criarRaca({ nome: 'Nelore' });
        const r = await patch(admin, 'racas', raca.id, {});
        expect(r.status).toBe(400);
        expect(r.body.message).toBe('Forneça pelo menos um campo para atualizar.');
        expect(r.body.tipo).toBe('validationError');
    });

    it('CAT-PATCH-05 campo extra (.strict())', async () => {
        const raca = await criarRaca({ nome: 'Nelore' });
        const r = await patch(admin, 'racas', raca.id, { nome: 'X', extra: 1 });
        expect(r.status).toBe(400);
        expect(r.body.tipo).toBe('validationError');
    });

    it('CAT-PATCH-06 nome duplicado ao renomear', async () => {
        const raca = await criarRaca({ nome: 'Nelore' });
        await criarRaca({ nome: 'Angus' });
        const r = await patch(admin, 'racas', raca.id, { nome: 'Angus' });
        expect(r.status).toBe(409);
        expect(r.body.tipo).toBe('conflict');
    });

    it('CAT-PATCH-07 renomear para o próprio nome atual', async () => {
        const raca = await criarRaca({ nome: 'Nelore' });
        const r = await patch(admin, 'racas', raca.id, { nome: 'Nelore' });
        expect(r.status).toBe(200);
        expect(r.body.data.nome).toBe('Nelore');
    });

    it('CAT-PATCH-08 ID em formato inválido', async () => {
        const r = await patch(admin, 'racas', 'abc', { nome: 'X' });
        expect(r.status).toBe(400);
        expect(r.body.tipo).toBe('validationError');
    });

    it('CAT-PATCH-09 UUID válido mas inexistente', async () => {
        const r = await patch(admin, 'racas', randomUUID(), { nome: 'Nelore' });
        expect(r.status).toBe(404);
        expect(r.body.tipo).toBe('resourceNotFound');
    });

    it('CAT-PATCH-10 :entidade inexistente', async () => {
        const r = await patch(admin, 'nao-existe', randomUUID(), { nome: 'Nelore' });
        expect(r.status).toBe(404);
        expect(r.body.tipo).toBe('resourceNotFound');
    });

    it('CAT-PATCH-11 401 sem token', async () => {
        const raca = await criarRaca({ nome: 'Nelore' });
        const r = await api().patch(`/v1/catalogos/racas/${raca.id}`).send({ nome: 'X' });
        expect(r.status).toBe(401);
        expect(r.body.tipo).toBe('unauthorized');
    });

    it('CAT-PATCH-12 403 usuário comum (não admin)', async () => {
        const raca = await criarRaca({ nome: 'Nelore' });
        const r = await patch(a, 'racas', raca.id, { nome: 'X' });
        expect(r.status).toBe(403);
        expect(r.body.tipo).toBe('forbidden');
    });
});
