import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import DbConnect from '../../../src/config/dbConnect.js';
import { api } from '../../apoio/cliente.js';
import { criarUsuario } from '../../apoio/auth.js';
import { criarPropriedade, criarPasto, criarRebanho, criarRaca } from '../../apoio/fabricas.js';

describe('DELETE /v1/catalogos/:entidade/:id', () => {
    let admin;
    let a;

    beforeEach(async () => {
        admin = await criarUsuario({ admin: true });
        a = await criarUsuario();
    });

    const del = (usuario, entidade, id) =>
        api().delete(`/v1/catalogos/${entidade}/${id}`).set('Authorization', usuario.bearer);

    it('CAT-DELETE-01 admin arquiva item sem dependentes', async () => {
        const raca = await criarRaca({ nome: 'Nelore' });
        const r = await del(admin, 'racas', raca.id);
        expect(r.status).toBe(200);
        expect(r.body.message).toBe('Item de catálogo removido com sucesso.');
        expect(r.body.data.ativo).toBe(false);
        const salvo = await DbConnect.prisma.raca.findUnique({ where: { id: raca.id } });
        expect(salvo).not.toBeNull();
        expect(salvo.ativo).toBe(false);
    });

    it('CAT-DELETE-02 trava de dependência (409)', async () => {
        const raca = await criarRaca({ nome: 'Nelore' });
        const propriedade = await criarPropriedade(a.id);
        const pasto = await criarPasto(propriedade.id);
        await criarRebanho(propriedade.id, pasto.id, { racaId: raca.id });

        const r = await del(admin, 'racas', raca.id);
        expect(r.status).toBe(409);
        expect(r.body.tipo).toBe('conflict');
        expect(r.body.errors[0].message).toBe('Este(a) Raça está vinculado(a) a 1 registro(s) e não pode ser excluído(a).');
        const salvo = await DbConnect.prisma.raca.findUnique({ where: { id: raca.id } });
        expect(salvo.ativo).toBe(true);
    });

    it('CAT-DELETE-03 ID em formato inválido', async () => {
        const r = await del(admin, 'racas', 'abc');
        expect(r.status).toBe(400);
        expect(r.body.tipo).toBe('validationError');
    });

    it('CAT-DELETE-04 UUID válido mas inexistente', async () => {
        const r = await del(admin, 'racas', randomUUID());
        expect(r.status).toBe(404);
        expect(r.body.tipo).toBe('resourceNotFound');
    });

    it('CAT-DELETE-05 :entidade inexistente', async () => {
        const r = await del(admin, 'nao-existe', randomUUID());
        expect(r.status).toBe(404);
        expect(r.body.tipo).toBe('resourceNotFound');
    });

    it('CAT-DELETE-06 401 sem token', async () => {
        const raca = await criarRaca({ nome: 'Nelore' });
        const r = await api().delete(`/v1/catalogos/racas/${raca.id}`);
        expect(r.status).toBe(401);
        expect(r.body.tipo).toBe('unauthorized');
    });

    it('CAT-DELETE-07 403 usuário comum (não admin)', async () => {
        const raca = await criarRaca({ nome: 'Nelore' });
        const r = await del(a, 'racas', raca.id);
        expect(r.status).toBe(403);
        expect(r.body.tipo).toBe('forbidden');
    });
});
