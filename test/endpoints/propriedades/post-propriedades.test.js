import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import DbConnect from '../../../src/config/dbConnect.js';
import { api } from '../../apoio/cliente.js';
import { criarUsuario } from '../../apoio/auth.js';
import { criarPropriedade } from '../../apoio/fabricas.js';

describe('POST /v1/propriedades', () => {
    let a;
    beforeEach(async () => { a = await criarUsuario(); });

    const post = (usuario, corpo) =>
        api().post('/v1/propriedades').set('Authorization', usuario.bearer).send(corpo);

    it('PROP-POST-01 cria com nome apenas (campos opcionais ausentes)', async () => {
        const r = await post(a, { nome: 'Fazenda Boa Vista' });
        expect(r.status).toBe(201);
        expect(r.body.errors).toEqual([]);
        expect(r.body.data.id).toMatch(/^[0-9a-f-]{36}$/);
        expect(r.body.data.usuario.id).toBe(a.id);
        expect(r.body.data.ativo).toBe(true);
    });

    it('PROP-POST-02 cria com localizacao e areaTotalHa válidos', async () => {
        const r = await post(a, { nome: 'Fazenda Boa Vista', localizacao: 'Vilhena,RO', areaTotalHa: 100.5 });
        expect(r.status).toBe(201);
        expect(r.body.data.localizacao).toBeDefined();
        expect(r.body.data.areaTotalHa).toBeDefined();
    });

    it('PROP-POST-03 localizacao "vilhena,ro" é normalizada', async () => {
        const r = await post(a, { nome: 'Fazenda', localizacao: 'vilhena,ro' });
        expect(r.status).toBe(201);
        expect(r.body.data.localizacao).toBe('Vilhena,RO');
    });

    it('PROP-POST-04 aceita id gerado pelo cliente (offline-first)', async () => {
        const id = randomUUID();
        const r = await post(a, { id, nome: 'Offline' });
        expect(r.status).toBe(201);
        expect(r.body.data.id).toBe(id);
    });

    it('PROP-POST-05 corpo vazio', async () => {
        const r = await post(a, {});
        expect(r.status).toBe(400);
        expect(r.body.tipo).toBe('validationError');
        expect(r.body.errors[0].path).toBe('body');
        expect(r.body.message).toBe('Forneça os dados da propriedade.');
    });

    it('PROP-POST-06 sem nome (obrigatório)', async () => {
        const r = await post(a, { localizacao: 'Vilhena,RO' });
        expect(r.status).toBe(400);
        expect(r.body.errors[0].path).toBe('nome');
    });

    it('PROP-POST-07 nome com 1 caractere (abaixo do mínimo de 2)', async () => {
        const r = await post(a, { nome: 'F' });
        expect(r.status).toBe(400);
        expect(r.body.errors[0].path).toBe('nome');
        expect(r.body.errors[0].message).toContain('pelo menos 2 caracteres');
    });

    it('PROP-POST-08 nome com mais de 150 caracteres', async () => {
        const r = await post(a, { nome: 'A'.repeat(151) });
        expect(r.status).toBe(400);
        expect(r.body.errors[0].path).toBe('nome');
        expect(r.body.errors[0].message).toContain('no máximo 150 caracteres');
    });

    it('PROP-POST-09 campo extra no corpo (.strict())', async () => {
        const r = await post(a, { nome: 'Fazenda', extra: 1 });
        expect(r.status).toBe(400);
        expect(r.body.tipo).toBe('validationError');
        expect(r.body.errors[0].message).toContain('extra');
    });

    it('PROP-POST-10 localizacao fora do formato "Cidade,UF"', async () => {
        const r = await post(a, { nome: 'Fazenda', localizacao: 'apenas cidade' });
        expect(r.status).toBe(400);
        expect(r.body.errors[0].path).toBe('localizacao');
        expect(r.body.errors[0].message).toContain('Cidade,UF');
    });

    it('PROP-POST-11 areaTotalHa negativo ou zero', async () => {
        const r = await post(a, { nome: 'Fazenda', areaTotalHa: 0 });
        expect(r.status).toBe(400);
        expect(r.body.errors[0].path).toBe('areaTotalHa');
        expect(r.body.errors[0].message).toContain('deve ser um número positivo');
    });

    it('PROP-POST-12 id enviado não é UUID válido', async () => {
        const r = await post(a, { id: 'nao-uuid', nome: 'Fazenda' });
        expect(r.status).toBe(400);
        expect(r.body.errors[0].path).toBe('id');
        expect(r.body.errors[0].message).toContain('deve ser um UUID válido');
    });

    it('PROP-POST-13 sem header de autenticação', async () => {
        const r = await api().post('/v1/propriedades').send({ nome: 'Fazenda' });
        expect(r.status).toBe(401);
        expect(r.body.tipo).toBe('unauthorized');
    });

    it('PROP-POST-14 token inválido/expirado', async () => {
        const r = await api()
            .post('/v1/propriedades')
            .set('Authorization', 'Bearer token-invalido')
            .send({ nome: 'Fazenda' });
        expect(r.status).toBe(401);
        expect(r.body.tipo).toBe('unauthorized');
        expect(r.body.message).toBe('Sessão inválida ou expirada. Faça login novamente.');
    });

    it('PROP-POST-15 nome duplicado: já existe propriedade ativa com o mesmo nome para o mesmo usuário (case-insensitive)', async () => {
        await criarPropriedade(a.id, { nome: 'Fazenda X' });
        const r = await post(a, { nome: 'fazenda x' });
        expect(r.status).toBe(409);
        expect(r.body.tipo).toBe('conflict');
        expect(r.body.errors[0].path).toBe('nome');
        expect(r.body.message).toBe('Já existe uma propriedade com este nome para este usuário.');
    });

    it('PROP-POST-16 mesmo nome de uma propriedade inativa (arquivada) do mesmo usuário', async () => {
        await criarPropriedade(a.id, { nome: 'Fazenda X', ativo: false });
        const r = await post(a, { nome: 'Fazenda X' });
        expect(r.status).toBe(201);
    });

    it('PROP-POST-17 mesmo nome, usuários diferentes (A e B)', async () => {
        const b = await criarUsuario();
        await criarPropriedade(a.id, { nome: 'Repetida' });
        const r = await post(b, { nome: 'Repetida' });
        expect(r.status).toBe(201);
        const salvo = await DbConnect.prisma.propriedade.findUnique({ where: { id: r.body.data.id } });
        expect(salvo.usuarioId).toBe(b.id);
    });
});
