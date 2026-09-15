import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import DbConnect from '../../../src/config/dbConnect.js';
import { api } from '../../apoio/cliente.js';
import { criarUsuario } from '../../apoio/auth.js';
import { criarPropriedade, criarPasto, criarRebanho } from '../../apoio/fabricas.js';

describe('PATCH /v1/propriedades/:id', () => {
    let a;
    beforeEach(async () => { a = await criarUsuario(); });

    const patch = (usuario, id, corpo) =>
        api().patch(`/v1/propriedades/${id}`).set('Authorization', usuario.bearer).send(corpo);

    it('PROP-PATCH-ID-01 atualiza nome', async () => {
        const propriedade = await criarPropriedade(a.id);
        const r = await patch(a, propriedade.id, { nome: 'Novo Nome' });
        expect(r.status).toBe(200);
        expect(r.body.data.nome).toBe('Novo Nome');
        const salvo = await DbConnect.prisma.propriedade.findUnique({ where: { id: propriedade.id } });
        expect(salvo.nome).toBe('Novo Nome');
    });

    it('PROP-PATCH-ID-02 atualiza localizacao (normalizada)', async () => {
        const propriedade = await criarPropriedade(a.id);
        const r = await patch(a, propriedade.id, { localizacao: 'cacoal,ro' });
        expect(r.status).toBe(200);
        expect(r.body.data.localizacao).toBe('Cacoal,RO');
    });

    it('PROP-PATCH-ID-03 atualiza areaTotalHa', async () => {
        const propriedade = await criarPropriedade(a.id);
        const r = await patch(a, propriedade.id, { areaTotalHa: 42.5 });
        expect(r.status).toBe(200);
        // Prisma Decimal serializa como string em JSON.
        expect(Number(r.body.data.areaTotalHa)).toBe(42.5);
    });

    it('PROP-PATCH-ID-04 corpo vazio', async () => {
        const propriedade = await criarPropriedade(a.id);
        const r = await patch(a, propriedade.id, {});
        expect(r.status).toBe(400);
        expect(r.body.errors[0].path).toBe('body');
        expect(r.body.message).toBe('Forneça pelo menos um campo para atualizar.');
    });

    it('PROP-PATCH-ID-05 campo extra no corpo (.strict())', async () => {
        const propriedade = await criarPropriedade(a.id);
        const r = await patch(a, propriedade.id, { extra: 1 });
        expect(r.status).toBe(400);
        expect(r.body.errors[0].message).toContain('extra');
    });

    it('PROP-PATCH-ID-06 id inexistente', async () => {
        const r = await patch(a, randomUUID(), { nome: 'Novo' });
        expect(r.status).toBe(404);
        expect(r.body.tipo).toBe('resourceNotFound');
    });

    it('PROP-PATCH-ID-07 multi-tenancy: B tenta editar propriedade de A', async () => {
        const b = await criarUsuario();
        const propriedade = await criarPropriedade(a.id, { nome: 'Fazenda de A' });
        const r = await patch(b, propriedade.id, { nome: 'Roubada' });
        expect(r.status).toBe(404);
        expect(r.body.tipo).toBe('resourceNotFound');
        const salvo = await DbConnect.prisma.propriedade.findUnique({ where: { id: propriedade.id } });
        expect(salvo.nome).toBe('Fazenda de A');
    });

    it('PROP-PATCH-ID-08 nome já usado por outra propriedade ativa do mesmo usuário', async () => {
        await criarPropriedade(a.id, { nome: 'Fazenda X' });
        const y = await criarPropriedade(a.id, { nome: 'Fazenda Y' });
        const r = await patch(a, y.id, { nome: 'Fazenda X' });
        expect(r.status).toBe(409);
        expect(r.body.tipo).toBe('conflict');
        expect(r.body.errors[0].path).toBe('nome');
    });

    it('PROP-PATCH-ID-09 reenviar o próprio nome atual (sem mudar)', async () => {
        const propriedade = await criarPropriedade(a.id, { nome: 'Fazenda X' });
        const r = await patch(a, propriedade.id, { nome: 'Fazenda X' });
        expect(r.status).toBe(200);
    });

    it('PROP-PATCH-ID-10 ativo: false com rebanhos ativos vinculados (via pasto)', async () => {
        const propriedade = await criarPropriedade(a.id);
        const pasto = await criarPasto(propriedade.id);
        await criarRebanho(propriedade.id, pasto.id);
        const r = await patch(a, propriedade.id, { ativo: false });
        expect(r.status).toBe(400);
        expect(r.body.tipo).toBe('validationError');
        expect(r.body.errors[0].path).toBe('ativo');
        expect(r.body.message).toBe('A propriedade ainda possui rebanhos vinculados a ela.');
    });

    it('PROP-PATCH-ID-11 ativo: false sem rebanhos ativos', async () => {
        const propriedade = await criarPropriedade(a.id);
        const r = await patch(a, propriedade.id, { ativo: false });
        expect(r.status).toBe(200);
        expect(r.body.data.ativo).toBe(false);
        const salvo = await DbConnect.prisma.propriedade.findUnique({ where: { id: propriedade.id } });
        expect(salvo.ativo).toBe(false);
    });

    it('PROP-PATCH-ID-12 reativa (ativo: true) uma propriedade inativa', async () => {
        const propriedade = await criarPropriedade(a.id, { ativo: false });
        const r = await patch(a, propriedade.id, { ativo: true });
        expect(r.status).toBe(200);
        expect(r.body.data.ativo).toBe(true);
    });

    it('PROP-PATCH-ID-13 :id não é UUID válido', async () => {
        const r = await patch(a, 'nao-uuid', { nome: 'Novo' });
        expect(r.status).toBe(400);
    });

    it('PROP-PATCH-ID-14 sem token', async () => {
        const propriedade = await criarPropriedade(a.id);
        const r = await api().patch(`/v1/propriedades/${propriedade.id}`).send({ nome: 'Novo' });
        expect(r.status).toBe(401);
        expect(r.body.tipo).toBe('unauthorized');
    });
});
