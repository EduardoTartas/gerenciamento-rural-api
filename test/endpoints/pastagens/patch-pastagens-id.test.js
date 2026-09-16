import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import DbConnect from '../../../src/config/dbConnect.js';
import { api } from '../../apoio/cliente.js';
import { criarUsuario } from '../../apoio/auth.js';
import { criarPropriedade, criarPasto, criarRebanho } from '../../apoio/fabricas.js';

describe('PATCH /v1/pastagens/:id', () => {
    let a;
    let propriedade;

    beforeEach(async () => {
        a = await criarUsuario();
        propriedade = await criarPropriedade(a.id);
    });

    const patch = (usuario, id, corpo) =>
        api().patch(`/v1/pastagens/${id}`).set('Authorization', usuario.bearer).send(corpo);

    it('PAST-PATCH-ID-01 atualiza nome', async () => {
        const pasto = await criarPasto(propriedade.id);
        const r = await patch(a, pasto.id, { nome: 'Novo Nome' });
        expect(r.status).toBe(200);
        expect(r.body.data.nome).toBe('Novo Nome');
        const salvo = await DbConnect.prisma.pasto.findUnique({ where: { id: pasto.id } });
        expect(salvo.nome).toBe('Novo Nome');
    });

    it('PAST-PATCH-ID-02 atualiza extensaoHa e tipoPastagem', async () => {
        const pasto = await criarPasto(propriedade.id);
        const r = await patch(a, pasto.id, { extensaoHa: 8.5, tipoPastagem: 'Mombaça' });
        expect(r.status).toBe(200);
        expect(r.body.data.extensaoHa).toBe('8.5');
        expect(r.body.data.tipoPastagem).toBe('Mombaça');
    });

    it('PAST-PATCH-ID-03 força status para "Ocupado" sem rebanhos (nenhuma trava aplicável)', async () => {
        const pasto = await criarPasto(propriedade.id, { status: 'Vazio' });
        const r = await patch(a, pasto.id, { status: 'Ocupado' });
        expect(r.status).toBe(200);
        expect(r.body.data.status).toBe('Ocupado');
    });

    it('PAST-PATCH-ID-04 corpo vazio ({})', async () => {
        const pasto = await criarPasto(propriedade.id);
        const r = await patch(a, pasto.id, {});
        expect(r.status).toBe(400);
        expect(r.body.errors[0].path).toBe('body');
        expect(r.body.message).toBe('Forneça pelo menos um campo para atualizar.');
    });

    it('PAST-PATCH-ID-05 campo extra no corpo (.strict())', async () => {
        const pasto = await criarPasto(propriedade.id);
        const r = await patch(a, pasto.id, { extra: 1 });
        expect(r.status).toBe(400);
        expect(r.body.errors.length).toBeGreaterThan(0);
    });

    it('PAST-PATCH-ID-06 status fora do enum', async () => {
        const pasto = await criarPasto(propriedade.id);
        const r = await patch(a, pasto.id, { status: 'Invalido' });
        expect(r.status).toBe(400);
        expect(r.body.errors.some((e) => e.path === 'status')).toBe(true);
    });

    it('PAST-PATCH-ID-07 id inexistente', async () => {
        const r = await patch(a, randomUUID(), { nome: 'Novo Nome' });
        expect(r.status).toBe(404);
        expect(r.body.tipo).toBe('resourceNotFound');
    });

    it('PAST-PATCH-ID-08 multi-tenancy: B tenta editar pasto de A', async () => {
        const pasto = await criarPasto(propriedade.id);
        const b = await criarUsuario();
        const r = await patch(b, pasto.id, { nome: 'Roubado' });
        expect(r.status).toBe(404);
        expect(r.body.tipo).toBe('resourceNotFound');
    });

    it('PAST-PATCH-ID-09 nome já usado por outro pasto ativo na mesma propriedade', async () => {
        await criarPasto(propriedade.id, { nome: 'Piquete Existente' });
        const pasto = await criarPasto(propriedade.id, { nome: 'Piquete Alvo' });
        const r = await patch(a, pasto.id, { nome: 'Piquete Existente' });
        expect(r.status).toBe(409);
        expect(r.body.tipo).toBe('conflict');
        expect(r.body.errors[0].path).toBe('nome');
    });

    it('PAST-PATCH-ID-10 status: "Vazio" com rebanho ativo alocado no pasto', async () => {
        const pasto = await criarPasto(propriedade.id, { status: 'Ocupado' });
        await criarRebanho(propriedade.id, pasto.id);
        const r = await patch(a, pasto.id, { status: 'Vazio' });
        expect(r.status).toBe(400);
        expect(r.body.tipo).toBe('validationError');
        expect(r.body.errors[0].path).toBe('status');
        expect(r.body.errors[0].message).toContain('há rebanhos no pasto');
    });

    it('PAST-PATCH-ID-11 status: "Descanso" com rebanho ativo alocado', async () => {
        const pasto = await criarPasto(propriedade.id, { status: 'Ocupado' });
        await criarRebanho(propriedade.id, pasto.id);
        const r = await patch(a, pasto.id, { status: 'Descanso' });
        expect(r.status).toBe(400);
        expect(r.body.tipo).toBe('validationError');
        expect(r.body.errors[0].path).toBe('status');
        expect(r.body.errors[0].message).toContain('há rebanhos no pasto');
    });

    it('PAST-PATCH-ID-12 ativo: false com rebanho ativo no pasto', async () => {
        const pasto = await criarPasto(propriedade.id, { status: 'Ocupado' });
        await criarRebanho(propriedade.id, pasto.id);
        const r = await patch(a, pasto.id, { ativo: false });
        expect(r.status).toBe(400);
        expect(r.body.tipo).toBe('validationError');
        expect(r.body.errors[0].path).toBe('ativo');
        expect(r.body.message).toBe('Pasto ainda contém rebanhos vinculados.');
    });

    it('PAST-PATCH-ID-13 ativo: false sem rebanhos', async () => {
        const pasto = await criarPasto(propriedade.id);
        const r = await patch(a, pasto.id, { ativo: false });
        expect(r.status).toBe(200);
        expect(r.body.data.ativo).toBe(false);
    });

    it('PAST-PATCH-ID-14 atualiza dataUltimaSaida manualmente', async () => {
        const pasto = await criarPasto(propriedade.id);
        const dataUltimaSaida = '2026-01-10T12:00:00.000Z';
        const r = await patch(a, pasto.id, { dataUltimaSaida });
        expect(r.status).toBe(200);
        expect(new Date(r.body.data.dataUltimaSaida).toISOString()).toBe(dataUltimaSaida);
    });

    it('PAST-PATCH-ID-15 :id não é UUID válido', async () => {
        const r = await patch(a, 'nao-uuid', { nome: 'X' });
        expect(r.status).toBe(400);
        expect(r.body.errors[0].message).toBe('ID de pastagem inválido. Deve ser um UUID válido.');
    });

    it('PAST-PATCH-ID-16 sem token', async () => {
        const pasto = await criarPasto(propriedade.id);
        const r = await api().patch(`/v1/pastagens/${pasto.id}`).send({ nome: 'X' });
        expect(r.status).toBe(401);
        expect(r.body.tipo).toBe('unauthorized');
    });
});
