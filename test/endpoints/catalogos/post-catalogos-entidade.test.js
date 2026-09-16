import { beforeEach, describe, expect, it } from 'vitest';
import DbConnect from '../../../src/config/dbConnect.js';
import { api } from '../../apoio/cliente.js';
import { criarUsuario } from '../../apoio/auth.js';
import { criarRaca } from '../../apoio/fabricas.js';

describe('POST /v1/catalogos/:entidade', () => {
    let admin;
    let a;

    beforeEach(async () => {
        admin = await criarUsuario({ admin: true });
        a = await criarUsuario();
    });

    const post = (usuario, entidade, corpo) =>
        api().post(`/v1/catalogos/${entidade}`).set('Authorization', usuario.bearer).send(corpo);

    it('CAT-POST-01 admin cria item com nome válido', async () => {
        const r = await post(admin, 'racas', { nome: 'Nelore' });
        expect(r.status).toBe(201);
        expect(r.body.errors).toEqual([]);
        expect(r.body.message).toBe('Item de catálogo criado com sucesso.');
        expect(r.body.data).toMatchObject({ nome: 'Nelore', ativo: true });
        expect(r.body.data.id).toBeDefined();
        const salvo = await DbConnect.prisma.raca.findUnique({ where: { id: r.body.data.id } });
        expect(salvo.nome).toBe('Nelore');
        expect(salvo.ativo).toBe(true);
    });

    it('CAT-POST-02 corpo vazio', async () => {
        const r = await post(admin, 'racas', {});
        expect(r.status).toBe(400);
        expect(r.body.message).toBe('Forneça os dados do item de catálogo.');
        expect(r.body.tipo).toBe('validationError');
        expect(r.body.errors[0].path).toBe('body');
    });

    it('CAT-POST-03 nome ausente', async () => {
        const r = await post(admin, 'racas', { outro: 'valor' });
        expect(r.status).toBe(400);
        expect(r.body.tipo).toBe('validationError');
        expect(r.body.errors.some((e) => e.path === 'nome')).toBe(true);
    });

    it('CAT-POST-04 nome com menos de 2 caracteres', async () => {
        const r = await post(admin, 'racas', { nome: 'A' });
        expect(r.status).toBe(400);
        expect(r.body.errors.some((e) => e.message === 'O nome deve ter pelo menos 2 caracteres.')).toBe(true);
    });

    it('CAT-POST-05 nome com mais de 100 caracteres', async () => {
        const r = await post(admin, 'racas', { nome: 'A'.repeat(101) });
        expect(r.status).toBe(400);
        expect(r.body.errors.some((e) => e.message === 'O nome deve ter no máximo 100 caracteres.')).toBe(true);
    });

    it('CAT-POST-06 campo extra no corpo (.strict())', async () => {
        const r = await post(admin, 'racas', { nome: 'Nelore', extra: 1 });
        expect(r.status).toBe(400);
        expect(r.body.tipo).toBe('validationError');
        // Zod v4: issue `unrecognized_keys` chega com path: [] — o campo aparece na mensagem.
        expect(r.body.errors.some((e) => e.message.includes('extra'))).toBe(true);
    });

    it('CAT-POST-07 nome duplicado (case-insensitive)', async () => {
        await criarRaca({ nome: 'Nelore' });
        const r = await post(admin, 'racas', { nome: 'nelore' });
        expect(r.status).toBe(409);
        expect(r.body.tipo).toBe('conflict');
        expect(r.body.message).toBe('Já existe um(a) Raça com este nome.');
    });

    // CAT-POST-08: `nome` tem `@unique` incondicional no banco (não é parcial `WHERE ativo = true`
    // como em `propriedades`) — a criação colide via P2002 antes de a regra de negócio (que só olha
    // itens ativos) rodar. Ver Divergências.
    it.fails('CAT-POST-08 nome igual a item inativo é aceito', async () => {
        await criarRaca({ nome: 'Nelore', ativo: false });
        const r = await post(admin, 'racas', { nome: 'Nelore' });
        expect(r.status).toBe(201);
        expect(r.body.data.nome).toBe('Nelore');
    });

    it('CAT-POST-09 :entidade inexistente', async () => {
        const r = await post(admin, 'nao-existe', { nome: 'Nelore' });
        expect(r.status).toBe(404);
        expect(r.body.tipo).toBe('resourceNotFound');
    });

    it('CAT-POST-10 401 sem token', async () => {
        const r = await api().post('/v1/catalogos/racas').send({ nome: 'Nelore' });
        expect(r.status).toBe(401);
        expect(r.body.tipo).toBe('unauthorized');
    });

    it('CAT-POST-11 403 usuário comum (não admin)', async () => {
        const r = await post(a, 'racas', {});
        expect(r.status).toBe(403);
        expect(r.body.tipo).toBe('forbidden');
        expect(r.body.message).toBe('Esta ação exige perfil administrativo.');
    });
});
