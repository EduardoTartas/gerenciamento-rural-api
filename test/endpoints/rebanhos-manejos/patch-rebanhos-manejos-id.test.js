import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import DbConnect from '../../../src/config/dbConnect.js';
import { api } from '../../apoio/cliente.js';
import { criarUsuario } from '../../apoio/auth.js';
import { criarPropriedade, criarPasto, criarRebanho, criarTipoManejoRebanho } from '../../apoio/fabricas.js';
import { criarManejoRebanho } from './apoio-local.js';

describe('PATCH /v1/rebanhos/manejos/:id', () => {
    let a, propriedade, pasto, rebanho, tipoManejo, manejo;

    beforeEach(async () => {
        a = await criarUsuario();
        propriedade = await criarPropriedade(a.id);
        pasto = await criarPasto(propriedade.id);
        rebanho = await criarRebanho(propriedade.id, pasto.id);
        tipoManejo = await criarTipoManejoRebanho();
        manejo = await criarManejoRebanho(rebanho.id, tipoManejo.id, { dataAtividade: new Date('2026-01-01T00:00:00Z') });
    });

    const patch = (usuario, id, corpo) =>
        api().patch(`/v1/rebanhos/manejos/${id}`).set('Authorization', usuario.bearer).send(corpo);

    it('MREB-PATCH-ID-01 atualiza medicamentoVacina/observacoes', async () => {
        const r = await patch(a, manejo.id, { medicamentoVacina: 'Vermífugo X', observacoes: 'Aplicado no curral' });
        expect(r.status).toBe(200);
        expect(r.body.data.medicamentoVacina).toBe('Vermífugo X');
        expect(r.body.data.observacoes).toBe('Aplicado no curral');
    });

    it('MREB-PATCH-ID-02 corpo vazio', async () => {
        const r = await patch(a, manejo.id, {});
        expect(r.status).toBe(400);
        expect(r.body.errors[0].path).toBe('body');
    });

    it('MREB-PATCH-ID-03 campo extra (.strict())', async () => {
        const r = await patch(a, manejo.id, { extra: 1 });
        expect(r.status).toBe(400);
        expect(r.body.tipo).toBe('validationError');
    });

    it('MREB-PATCH-ID-04 dataAtividade no futuro', async () => {
        const r = await patch(a, manejo.id, { dataAtividade: '2999-01-01T00:00:00.000Z' });
        expect(r.status).toBe(400);
        expect(r.body.errors[0].message).toContain('não pode ser no futuro');
    });

    it('MREB-PATCH-ID-05 id não é UUID', async () => {
        const r = await patch(a, 'nao-e-uuid', { observacoes: 'x' });
        expect(r.status).toBe(400);
        expect(r.body.tipo).toBe('validationError');
    });

    it('MREB-PATCH-ID-06 id inexistente', async () => {
        const r = await patch(a, randomUUID(), { observacoes: 'x' });
        expect(r.status).toBe(404);
        expect(r.body.tipo).toBe('resourceNotFound');
    });

    it('MREB-PATCH-ID-07 tipoManejoId inexistente ou inativo', async () => {
        const r = await patch(a, manejo.id, { tipoManejoId: randomUUID() });
        expect(r.status).toBe(404);
        expect(r.body.tipo).toBe('resourceNotFound');
        expect(r.body.errors[0].path).toBe('tipoManejoId');
    });

    it('MREB-PATCH-ID-08 atualiza pesoRegistrado, mas não recalcula pesoMedioAtual do rebanho', async () => {
        const r = await patch(a, manejo.id, { pesoRegistrado: 480 });
        expect(r.status).toBe(200);
        expect(Number(r.body.data.pesoRegistrado)).toBe(480);

        const rebanhoAtual = await DbConnect.prisma.rebanho.findUnique({ where: { id: rebanho.id } });
        expect(rebanhoAtual.pesoMedioAtual === null || Number(rebanhoAtual.pesoMedioAtual) !== 480).toBe(true);
    });

    it('MREB-PATCH-ID-09 sem token', async () => {
        const r = await api().patch(`/v1/rebanhos/manejos/${manejo.id}`).send({ observacoes: 'x' });
        expect(r.status).toBe(401);
        expect(r.body.tipo).toBe('unauthorized');
    });

    it('MREB-PATCH-ID-10 multi-tenancy: B tenta atualizar manejo de A', async () => {
        const b = await criarUsuario();
        const r = await patch(b, manejo.id, { observacoes: 'x' });
        expect(r.status).toBe(404);
        expect(r.body.tipo).toBe('resourceNotFound');
    });

    it('MREB-PATCH-ID-11 admin (não dono) tenta atualizar manejo de A', async () => {
        const admin = await criarUsuario({ admin: true });
        const r = await patch(admin, manejo.id, { observacoes: 'x' });
        expect(r.status).toBe(404);
        expect(r.body.tipo).toBe('resourceNotFound');
    });
});
