import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import DbConnect from '../../../src/config/dbConnect.js';
import { api } from '../../apoio/cliente.js';
import { criarUsuario } from '../../apoio/auth.js';
import { criarPropriedade, criarPasto, criarRebanho } from '../../apoio/fabricas.js';

describe('PATCH /v1/rebanhos/:id', () => {
    let a;
    let propriedade;
    let pasto;

    beforeEach(async () => {
        a = await criarUsuario();
        propriedade = await criarPropriedade(a.id);
        pasto = await criarPasto(propriedade.id);
    });

    const patch = (usuario, id, corpo) =>
        api().patch(`/v1/rebanhos/${id}`).set('Authorization', usuario.bearer).send(corpo);

    it('REB-PATCH-ID-01 atualiza nomeRebanho', async () => {
        const rebanho = await criarRebanho(propriedade.id, pasto.id);
        const r = await patch(a, rebanho.id, { nomeRebanho: 'Novo Nome' });
        expect(r.status).toBe(200);
        expect(r.body.data.nomeRebanho).toBe('Novo Nome');
        const salvo = await DbConnect.prisma.rebanho.findUnique({ where: { id: rebanho.id } });
        expect(salvo.nomeRebanho).toBe('Novo Nome');
    });

    it('REB-PATCH-ID-02 atualiza quantidadeCabecas/pesoMedioAtual', async () => {
        const rebanho = await criarRebanho(propriedade.id, pasto.id);
        const r = await patch(a, rebanho.id, { quantidadeCabecas: 42, pesoMedioAtual: 350.5 });
        expect(r.status).toBe(200);
        expect(r.body.data.quantidadeCabecas).toBe(42);
        expect(r.body.data.pesoMedioAtual).toBe('350.5');
    });

    it('REB-PATCH-ID-03 corpo vazio', async () => {
        const rebanho = await criarRebanho(propriedade.id, pasto.id);
        const r = await patch(a, rebanho.id, {});
        expect(r.status).toBe(400);
        expect(r.body.errors[0].path).toBe('body');
    });

    it('REB-PATCH-ID-04 campo extra (.strict())', async () => {
        const rebanho = await criarRebanho(propriedade.id, pasto.id);
        const r = await patch(a, rebanho.id, { extra: 1 });
        expect(r.status).toBe(400);
        expect(r.body.tipo).toBe('validationError');
    });

    it('REB-PATCH-ID-05 id não é UUID', async () => {
        const r = await patch(a, 'nao-uuid', { nomeRebanho: 'X' });
        expect(r.status).toBe(400);
    });

    it('REB-PATCH-ID-06 id inexistente', async () => {
        const r = await patch(a, randomUUID(), { nomeRebanho: 'Nome Válido' });
        expect(r.status).toBe(404);
        expect(r.body.tipo).toBe('resourceNotFound');
    });

    it('REB-PATCH-ID-07 nomeRebanho duplicado com outro rebanho ativo da mesma propriedade', async () => {
        await criarRebanho(propriedade.id, pasto.id, { nomeRebanho: 'Existente' });
        const outroPasto = await criarPasto(propriedade.id);
        const rebanho = await criarRebanho(propriedade.id, outroPasto.id, { nomeRebanho: 'Alvo' });
        const r = await patch(a, rebanho.id, { nomeRebanho: 'Existente' });
        expect(r.status).toBe(409);
        expect(r.body.tipo).toBe('conflict');
    });

    it('REB-PATCH-ID-08 tenta alterar pastoAtualId de rebanho ativo', async () => {
        const outroPasto = await criarPasto(propriedade.id);
        const rebanho = await criarRebanho(propriedade.id, pasto.id);
        const r = await patch(a, rebanho.id, { pastoAtualId: outroPasto.id });
        expect(r.status).toBe(400);
        expect(r.body.errors[0].path).toBe('pastoAtualId');
        expect(r.body.errors[0].message).toContain('rota de movimentação');
    });

    // Bug: RebanhoService._inativar usa `executor` fora de escopo
    // (src/service/RebanhoService.js:187) -> ReferenceError -> 500. Comportamento
    // correto esperado é 200 com soft-delete efetivo (ver Divergências no .md).
    it.fails('REB-PATCH-ID-09 envia ativo: false (inativação)', async () => {
        const rebanho = await criarRebanho(propriedade.id, pasto.id);
        const r = await patch(a, rebanho.id, { ativo: false });
        expect(r.status).toBe(200);
        expect(r.body.data.ativo).toBe(false);
        expect(r.body.data.pastoAtualId).toBeNull();
        const salvo = await DbConnect.prisma.rebanho.findUnique({ where: { id: rebanho.id } });
        expect(salvo.ativo).toBe(false);
        expect(salvo.pastoAtualId).toBeNull();
    });

    it('REB-PATCH-ID-10 reativa (ativo: true) sem informar pastoAtualId', async () => {
        const rebanho = await criarRebanho(propriedade.id, pasto.id, { ativo: false, pastoAtualId: null });
        const r = await patch(a, rebanho.id, { ativo: true });
        expect(r.status).toBe(400);
        expect(r.body.errors[0].path).toBe('pastoAtualId');
        expect(r.body.errors[0].message).toContain('Informe o pasto atual para reativar');
    });

    // Bug: RebanhoService._reativar usa `executor` fora de escopo
    // (src/service/RebanhoService.js:259) -> ReferenceError -> 500. Comportamento
    // correto esperado é 200 com reativação efetiva (ver Divergências no .md).
    it.fails('REB-PATCH-ID-11 reativa com pastoAtualId válido', async () => {
        const rebanho = await criarRebanho(propriedade.id, pasto.id, { ativo: false, pastoAtualId: null });
        const r = await patch(a, rebanho.id, { ativo: true, pastoAtualId: pasto.id });
        expect(r.status).toBe(200);
        expect(r.body.data.ativo).toBe(true);
        expect(r.body.data.pastoAtualId).toBe(pasto.id);
        const salvo = await DbConnect.prisma.rebanho.findUnique({ where: { id: rebanho.id } });
        expect(salvo.ativo).toBe(true);
        expect(salvo.pastoAtualId).toBe(pasto.id);
    });

    it('REB-PATCH-ID-12 reativa com pasto inativo', async () => {
        const pastoInativo = await criarPasto(propriedade.id, { ativo: false });
        const rebanho = await criarRebanho(propriedade.id, pasto.id, { ativo: false, pastoAtualId: null });
        const r = await patch(a, rebanho.id, { ativo: true, pastoAtualId: pastoInativo.id });
        expect(r.status).toBe(400);
        expect(r.body.errors[0].path).toBe('pastoAtualId');
    });

    it('REB-PATCH-ID-13 reativa com pasto de outra propriedade', async () => {
        const outraPropriedade = await criarPropriedade(a.id);
        const pastoDeOutra = await criarPasto(outraPropriedade.id);
        const rebanho = await criarRebanho(propriedade.id, pasto.id, { ativo: false, pastoAtualId: null });
        const r = await patch(a, rebanho.id, { ativo: true, pastoAtualId: pastoDeOutra.id });
        expect(r.status).toBe(400);
        expect(r.body.errors[0].path).toBe('pastoAtualId');
    });

    it('REB-PATCH-ID-14 sem token', async () => {
        const rebanho = await criarRebanho(propriedade.id, pasto.id);
        const r = await api().patch(`/v1/rebanhos/${rebanho.id}`).send({ nomeRebanho: 'X' });
        expect(r.status).toBe(401);
        expect(r.body.tipo).toBe('unauthorized');
    });

    it('REB-PATCH-ID-15 multi-tenancy: B tenta atualizar rebanho de A', async () => {
        const rebanho = await criarRebanho(propriedade.id, pasto.id);
        const b = await criarUsuario();
        const r = await patch(b, rebanho.id, { nomeRebanho: 'Roubado' });
        expect(r.status).toBe(404);
        expect(r.body.tipo).toBe('resourceNotFound');
    });

    it('REB-PATCH-ID-16 admin (não dono) tenta atualizar rebanho de A', async () => {
        const rebanho = await criarRebanho(propriedade.id, pasto.id);
        const admin = await criarUsuario({ admin: true });
        const r = await patch(admin, rebanho.id, { nomeRebanho: 'Roubado' });
        expect(r.status).toBe(404);
        expect(r.body.tipo).toBe('resourceNotFound');
    });
});
