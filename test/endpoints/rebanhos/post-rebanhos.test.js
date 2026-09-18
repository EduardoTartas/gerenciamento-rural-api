import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import DbConnect from '../../../src/config/dbConnect.js';
import { api } from '../../apoio/cliente.js';
import { criarUsuario } from '../../apoio/auth.js';
import { criarPropriedade, criarPasto, criarRebanho } from '../../apoio/fabricas.js';

describe('POST /v1/rebanhos', () => {
    let a;
    let propriedade;
    let pasto;

    beforeEach(async () => {
        a = await criarUsuario();
        propriedade = await criarPropriedade(a.id);
        pasto = await criarPasto(propriedade.id);
    });

    const post = (usuario, corpo) =>
        api().post('/v1/rebanhos').set('Authorization', usuario.bearer).send(corpo);

    it('REB-POST-01 cria com dados válidos', async () => {
        const r = await post(a, { propriedadeId: propriedade.id, nomeRebanho: 'Lote 1', pastoAtualId: pasto.id });
        expect(r.status).toBe(201);
        expect(r.body.errors).toEqual([]);
        expect(r.body.data.id).toBeDefined();
        expect(r.body.data.propriedadeId).toBe(propriedade.id);
        // POST devolve o mesmo formato de GET/PATCH, com relações aninhadas via REBANHO_SELECT.
        expect(r.body.data.propriedade).toMatchObject({ id: propriedade.id });
        expect(r.body.data.pastoAtual).toMatchObject({ id: pasto.id });
        const salvo = await DbConnect.prisma.rebanho.findUnique({ where: { id: r.body.data.id } });
        expect(salvo.propriedadeId).toBe(propriedade.id);
    });

    it('REB-POST-02 aceita id gerado pelo cliente (offline-first)', async () => {
        const id = randomUUID();
        const r = await post(a, { id, propriedadeId: propriedade.id, nomeRebanho: 'Lote Offline', pastoAtualId: pasto.id });
        expect(r.status).toBe(201);
        expect(r.body.data.id).toBe(id);
    });

    it('REB-POST-03 corpo vazio', async () => {
        const r = await post(a, {});
        expect(r.status).toBe(400);
        expect(r.body.tipo).toBe('validationError');
        expect(r.body.errors[0].path).toBe('body');
    });

    it('REB-POST-04 campo extra no corpo (.strict())', async () => {
        const r = await post(a, { propriedadeId: propriedade.id, nomeRebanho: 'Lote', pastoAtualId: pasto.id, extra: 1 });
        expect(r.status).toBe(400);
        expect(r.body.tipo).toBe('validationError');
    });

    it('REB-POST-05 falta propriedadeId', async () => {
        const r = await post(a, { nomeRebanho: 'Lote', pastoAtualId: pasto.id });
        expect(r.status).toBe(400);
        expect(r.body.errors.some((e) => e.path === 'propriedadeId')).toBe(true);
    });

    it('REB-POST-06 falta nomeRebanho', async () => {
        const r = await post(a, { propriedadeId: propriedade.id, pastoAtualId: pasto.id });
        expect(r.status).toBe(400);
        expect(r.body.errors.some((e) => e.path === 'nomeRebanho')).toBe(true);
    });

    it('REB-POST-07 falta pastoAtualId', async () => {
        const r = await post(a, { propriedadeId: propriedade.id, nomeRebanho: 'Lote' });
        expect(r.status).toBe(400);
        expect(r.body.errors.some((e) => e.path === 'pastoAtualId')).toBe(true);
    });

    it('REB-POST-08 propriedadeId não é UUID', async () => {
        const r = await post(a, { propriedadeId: 'nao-uuid', nomeRebanho: 'Lote', pastoAtualId: pasto.id });
        expect(r.status).toBe(400);
        expect(r.body.errors.some((e) => e.path === 'propriedadeId')).toBe(true);
    });

    it('REB-POST-09 quantidadeCabecas zero ou negativo', async () => {
        const r = await post(a, { propriedadeId: propriedade.id, nomeRebanho: 'Lote', pastoAtualId: pasto.id, quantidadeCabecas: 0 });
        expect(r.status).toBe(400);
        expect(r.body.errors.some((e) => e.path === 'quantidadeCabecas')).toBe(true);
    });

    it('REB-POST-10 pesoMedioAtual negativo', async () => {
        const r = await post(a, { propriedadeId: propriedade.id, nomeRebanho: 'Lote', pastoAtualId: pasto.id, pesoMedioAtual: -5 });
        expect(r.status).toBe(400);
        expect(r.body.errors.some((e) => e.path === 'pesoMedioAtual')).toBe(true);
    });

    it('REB-POST-11 sem token', async () => {
        const r = await api().post('/v1/rebanhos').send({ propriedadeId: propriedade.id, nomeRebanho: 'Lote', pastoAtualId: pasto.id });
        expect(r.status).toBe(401);
        expect(r.body.tipo).toBe('unauthorized');
    });

    it('REB-POST-12 token inválido/expirado', async () => {
        const r = await api().post('/v1/rebanhos').set('Authorization', 'Bearer token-invalido')
            .send({ propriedadeId: propriedade.id, nomeRebanho: 'Lote', pastoAtualId: pasto.id });
        expect(r.status).toBe(401);
        expect(r.body.tipo).toBe('unauthorized');
    });

    it('REB-POST-13 admin (não dono) cria rebanho em propriedade de A', async () => {
        const admin = await criarUsuario({ admin: true });
        const r = await post(admin, { propriedadeId: propriedade.id, nomeRebanho: 'Lote', pastoAtualId: pasto.id });
        expect(r.status).toBe(404);
        expect(r.body.tipo).toBe('resourceNotFound');
    });

    it('REB-POST-14 B tenta criar rebanho com propriedadeId de A', async () => {
        const b = await criarUsuario();
        const r = await post(b, { propriedadeId: propriedade.id, nomeRebanho: 'Lote', pastoAtualId: pasto.id });
        expect(r.status).toBe(404);
        expect(r.body.tipo).toBe('resourceNotFound');
        expect(r.body.message).toBe('Propriedade não encontrada ou não pertence ao usuário autenticado.');
    });

    it('REB-POST-15 propriedadeId inexistente', async () => {
        const r = await post(a, { propriedadeId: randomUUID(), nomeRebanho: 'Lote', pastoAtualId: pasto.id });
        expect(r.status).toBe(404);
        expect(r.body.tipo).toBe('resourceNotFound');
    });

    it('REB-POST-16 propriedade inativa', async () => {
        const inativa = await criarPropriedade(a.id, { ativo: false });
        const r = await post(a, { propriedadeId: inativa.id, nomeRebanho: 'Lote', pastoAtualId: pasto.id });
        expect(r.status).toBe(400);
        expect(r.body.tipo).toBe('validationError');
        expect(r.body.errors[0].path).toBe('propriedadeId');
    });

    it('REB-POST-17 nomeRebanho duplicado (ativo) na mesma propriedade', async () => {
        await criarRebanho(propriedade.id, pasto.id, { nomeRebanho: 'Repetido' });
        const outroPasto = await criarPasto(propriedade.id);
        const r = await post(a, { propriedadeId: propriedade.id, nomeRebanho: 'Repetido', pastoAtualId: outroPasto.id });
        expect(r.status).toBe(409);
        expect(r.body.tipo).toBe('conflict');
        expect(r.body.errors[0].path).toBe('nomeRebanho');
    });

    it('REB-POST-18 nomeRebanho igual a um rebanho inativo existente', async () => {
        await criarRebanho(propriedade.id, pasto.id, { nomeRebanho: 'Repetido', ativo: false, pastoAtualId: null });
        const r = await post(a, { propriedadeId: propriedade.id, nomeRebanho: 'Repetido', pastoAtualId: pasto.id });
        expect(r.status).toBe(201);
    });

    it('REB-POST-19 pastoAtualId inexistente', async () => {
        const r = await post(a, { propriedadeId: propriedade.id, nomeRebanho: 'Lote', pastoAtualId: randomUUID() });
        expect(r.status).toBe(404);
        expect(r.body.tipo).toBe('resourceNotFound');
    });

    it('REB-POST-20 pastoAtualId pertence a B', async () => {
        const b = await criarUsuario();
        const propriedadeB = await criarPropriedade(b.id);
        const pastoB = await criarPasto(propriedadeB.id);
        const r = await post(a, { propriedadeId: propriedade.id, nomeRebanho: 'Lote', pastoAtualId: pastoB.id });
        expect(r.status).toBe(404);
        expect(r.body.tipo).toBe('resourceNotFound');
    });

    it('REB-POST-21 pasto inativo', async () => {
        const pastoInativo = await criarPasto(propriedade.id, { ativo: false });
        const r = await post(a, { propriedadeId: propriedade.id, nomeRebanho: 'Lote', pastoAtualId: pastoInativo.id });
        expect(r.status).toBe(400);
        expect(r.body.tipo).toBe('validationError');
        expect(r.body.errors[0].path).toBe('pastoAtualId');
    });

    it('REB-POST-22 pasto pertence a outra propriedade do próprio A', async () => {
        const outraPropriedade = await criarPropriedade(a.id);
        const r = await post(a, { propriedadeId: outraPropriedade.id, nomeRebanho: 'Lote', pastoAtualId: pasto.id });
        expect(r.status).toBe(400);
        expect(r.body.errors[0].path).toBe('pastoAtualId');
        expect(r.body.errors[0].message).toContain('não pertence à mesma propriedade');
    });

    it('REB-POST-23 pasto já ocupado por outro rebanho ativo, sem permitirLotacaoConjunta', async () => {
        // status deliberadamente defasado ('Vazio'): a checagem conta rebanhos
        // ativos, não confia no campo status (cache) — ver RebanhoService.create.
        const pastoDefasado = await criarPasto(propriedade.id, { status: 'Vazio' });
        await criarRebanho(propriedade.id, pastoDefasado.id);
        const r = await post(a, { propriedadeId: propriedade.id, nomeRebanho: 'Lote 2', pastoAtualId: pastoDefasado.id });
        expect(r.status).toBe(400);
        expect(r.body.errors[0].path).toBe('pastoAtualId');
        expect(r.body.errors[0].message).toContain('já tem outro lote');
    });

    it('REB-POST-24 pasto ocupado, com permitirLotacaoConjunta: true', async () => {
        await criarRebanho(propriedade.id, pasto.id);
        const r = await post(a, {
            propriedadeId: propriedade.id, nomeRebanho: 'Lote 2', pastoAtualId: pasto.id, permitirLotacaoConjunta: true,
        });
        expect(r.status).toBe(201);
        const ativosNoPasto = await DbConnect.prisma.rebanho.count({ where: { pastoAtualId: pasto.id, ativo: true } });
        expect(ativosNoPasto).toBe(2);
    });

    it('REB-POST-25 transação: cria rebanho e marca pasto como Ocupado', async () => {
        expect(pasto.status).toBe('Vazio');
        const r = await post(a, { propriedadeId: propriedade.id, nomeRebanho: 'Lote', pastoAtualId: pasto.id });
        expect(r.status).toBe(201);
        const get = await api().get(`/v1/pastagens/${pasto.id}`).set('Authorization', a.bearer);
        expect(get.body.data.status).toBe('Ocupado');
    });

    it('REB-POST-26 dataEntradaPastoAtual omitida', async () => {
        const antes = Date.now();
        const r = await post(a, { propriedadeId: propriedade.id, nomeRebanho: 'Lote', pastoAtualId: pasto.id });
        expect(r.status).toBe(201);
        const data = new Date(r.body.data.dataEntradaPastoAtual).getTime();
        expect(data).toBeGreaterThanOrEqual(antes - 1000);
        expect(data).toBeLessThanOrEqual(Date.now() + 1000);
    });

    it('REB-POST-27 dataEntradaPastoAtual informada', async () => {
        const dataEntradaPastoAtual = '2026-01-10T12:00:00.000Z';
        const r = await post(a, { propriedadeId: propriedade.id, nomeRebanho: 'Lote', pastoAtualId: pasto.id, dataEntradaPastoAtual });
        expect(r.status).toBe(201);
        expect(new Date(r.body.data.dataEntradaPastoAtual).toISOString()).toBe(dataEntradaPastoAtual);
    });
});
