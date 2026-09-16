import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import DbConnect from '../../../src/config/dbConnect.js';
import { api } from '../../apoio/cliente.js';
import { criarUsuario } from '../../apoio/auth.js';
import { criarPropriedade, criarPasto, criarTipoManejoPasto } from '../../apoio/fabricas.js';
import { criarManejoPasto } from './apoio-local.js';

describe('PATCH /v1/pastagens/manejos/:id', () => {
    let a, propriedade, pasto, tipoManejo, manejo;

    beforeEach(async () => {
        a = await criarUsuario();
        propriedade = await criarPropriedade(a.id);
        pasto = await criarPasto(propriedade.id);
        tipoManejo = await criarTipoManejoPasto();
        manejo = await criarManejoPasto(pasto.id, tipoManejo.id, { dataAtividade: new Date('2026-01-01T00:00:00Z') });
    });

    const patch = (usuario, id, corpo) =>
        api().patch(`/v1/pastagens/manejos/${id}`).set('Authorization', usuario.bearer).send(corpo);

    it('MPAS-PATCH-ID-01 atualiza tipoManejoId para outro tipo válido', async () => {
        const outroTipo = await criarTipoManejoPasto();
        const r = await patch(a, manejo.id, { tipoManejoId: outroTipo.id });
        expect(r.status).toBe(200);
        expect(r.body.data.tipoManejoId).toBe(outroTipo.id);
    });

    it('MPAS-PATCH-ID-02 atualiza dataAtividade', async () => {
        const r = await patch(a, manejo.id, { dataAtividade: '2026-01-15T00:00:00.000Z' });
        expect(r.status).toBe(200);
        expect(new Date(r.body.data.dataAtividade).toISOString()).toBe('2026-01-15T00:00:00.000Z');
    });

    it('MPAS-PATCH-ID-03 atualiza observacoes', async () => {
        const r = await patch(a, manejo.id, { observacoes: 'Aplicação de calcário' });
        expect(r.status).toBe(200);
        expect(r.body.data.observacoes).toBe('Aplicação de calcário');
    });

    it('MPAS-PATCH-ID-04 corpo vazio', async () => {
        const r = await patch(a, manejo.id, {});
        expect(r.status).toBe(400);
        expect(r.body.message).toBe('Forneça pelo menos um campo para atualizar.');
    });

    it('MPAS-PATCH-ID-05 campo extra no corpo (.strict())', async () => {
        const r = await patch(a, manejo.id, { extra: 1 });
        expect(r.status).toBe(400);
        expect(r.body.errors[0].message).toContain('extra');
    });

    it('MPAS-PATCH-ID-06 envia itens no corpo', async () => {
        const r = await patch(a, manejo.id, { itens: [] });
        expect(r.status).toBe(400);
        expect(r.body.errors[0].message).toContain('itens');
    });

    it('MPAS-PATCH-ID-07 dataAtividade no futuro', async () => {
        const r = await patch(a, manejo.id, { dataAtividade: '2999-01-01T00:00:00.000Z' });
        expect(r.status).toBe(400);
        expect(r.body.errors[0].path).toBe('dataAtividade');
    });

    it('MPAS-PATCH-ID-08 id inexistente', async () => {
        const r = await patch(a, randomUUID(), { observacoes: 'x' });
        expect(r.status).toBe(404);
        expect(r.body.tipo).toBe('resourceNotFound');
    });

    it('MPAS-PATCH-ID-09 multi-tenancy: B tenta editar manejo de A', async () => {
        const b = await criarUsuario();
        const r = await patch(b, manejo.id, { observacoes: 'Roubado' });
        expect(r.status).toBe(404);
        expect(r.body.tipo).toBe('resourceNotFound');
        const salvo = await DbConnect.prisma.manejoPasto.findUnique({ where: { id: manejo.id } });
        expect(salvo.observacoes).not.toBe('Roubado');
    });

    it('MPAS-PATCH-ID-10 tipoManejoId inexistente ou inativo', async () => {
        const r = await patch(a, manejo.id, { tipoManejoId: randomUUID() });
        expect(r.status).toBe(404);
        expect(r.body.tipo).toBe('resourceNotFound');
        expect(r.body.errors[0].path).toBe('tipoManejoId');
    });

    it('MPAS-PATCH-ID-11 :id não é UUID válido', async () => {
        const r = await patch(a, 'nao-e-uuid', { observacoes: 'x' });
        expect(r.status).toBe(400);
        expect(r.body.errors[0].message).toBe('ID de manejo de pasto inválido. Deve ser um UUID válido.');
    });

    it('MPAS-PATCH-ID-12 sem token', async () => {
        const r = await api().patch(`/v1/pastagens/manejos/${manejo.id}`).send({ observacoes: 'x' });
        expect(r.status).toBe(401);
        expect(r.body.tipo).toBe('unauthorized');
    });
});
