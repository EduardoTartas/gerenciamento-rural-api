import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import DbConnect from '../../../src/config/dbConnect.js';
import { api } from '../../apoio/cliente.js';
import { criarUsuario } from '../../apoio/auth.js';
import { criarPropriedade, criarTipoInsumo, criarInsumo } from '../../apoio/fabricas.js';

describe('PATCH /v1/insumos/:id', () => {
    let a;
    let propriedade;
    let tipoInsumo;

    beforeEach(async () => {
        a = await criarUsuario();
        propriedade = await criarPropriedade(a.id);
        tipoInsumo = await criarTipoInsumo();
    });

    const patch = (usuario, id, corpo) =>
        api().patch(`/v1/insumos/${id}`).set('Authorization', usuario.bearer).send(corpo);

    it('INS-PATCH-ID-01 atualiza nome', async () => {
        const insumo = await criarInsumo(propriedade.id, { tipoInsumoId: tipoInsumo.id, nome: 'Nome Antigo' });
        const r = await patch(a, insumo.id, { nome: 'Nome Novo' });
        expect(r.status).toBe(200);
        expect(r.body.data.nome).toBe('Nome Novo');
        const salvo = await DbConnect.prisma.insumo.findUnique({ where: { id: insumo.id } });
        expect(salvo.nome).toBe('Nome Novo');
    });

    it('INS-PATCH-ID-02 atualiza destino/unidadeMedida/estoqueMinimo', async () => {
        const insumo = await criarInsumo(propriedade.id, { tipoInsumoId: tipoInsumo.id, destino: 'Pasto', unidadeMedida: 'kg' });
        const r = await patch(a, insumo.id, { destino: 'Rebanho', unidadeMedida: 'saco', estoqueMinimo: 25 });
        expect(r.status).toBe(200);
        expect(r.body.data.destino).toBe('Rebanho');
        expect(r.body.data.unidadeMedida).toBe('saco');
        // Decimal do Prisma serializa como string no JSON (sem conversão global p/ Number).
        expect(Number(r.body.data.estoqueMinimo)).toBe(25);
    });

    it('INS-PATCH-ID-03 ativo:false inativa (equivale a DELETE)', async () => {
        const insumo = await criarInsumo(propriedade.id, { tipoInsumoId: tipoInsumo.id });
        const r = await patch(a, insumo.id, { ativo: false });
        expect(r.status).toBe(200);
        expect(r.body.data.ativo).toBe(false);
        const salvo = await DbConnect.prisma.insumo.findUnique({ where: { id: insumo.id } });
        expect(salvo.ativo).toBe(false);
    });

    it('INS-PATCH-ID-04 ativo:true reativa', async () => {
        const insumo = await criarInsumo(propriedade.id, { tipoInsumoId: tipoInsumo.id, ativo: false });
        const r = await patch(a, insumo.id, { ativo: true });
        expect(r.status).toBe(200);
        expect(r.body.data.ativo).toBe(true);
    });

    it('INS-PATCH-ID-05 reativar quando o nome já foi reutilizado por outro insumo ativo', async () => {
        const x = await criarInsumo(propriedade.id, { tipoInsumoId: tipoInsumo.id, nome: 'Ração', ativo: false });
        await criarInsumo(propriedade.id, { tipoInsumoId: tipoInsumo.id, nome: 'Ração' });

        const r = await patch(a, x.id, { ativo: true });
        expect(r.status).toBe(409);
        expect(r.body.tipo).toBe('conflict');
        expect(r.body.errors[0].path).toBe('nome');
    });

    it('INS-PATCH-ID-06 troca nome para um já usado por outro insumo ativo da mesma propriedade', async () => {
        const insumo = await criarInsumo(propriedade.id, { tipoInsumoId: tipoInsumo.id, nome: 'Original' });
        await criarInsumo(propriedade.id, { tipoInsumoId: tipoInsumo.id, nome: 'Ocupado' });

        const r = await patch(a, insumo.id, { nome: 'Ocupado' });
        expect(r.status).toBe(409);
        expect(r.body.tipo).toBe('conflict');
        expect(r.body.errors[0].path).toBe('nome');
    });

    it('INS-PATCH-ID-07 troca só a capitalização do próprio nome', async () => {
        const insumo = await criarInsumo(propriedade.id, { tipoInsumoId: tipoInsumo.id, nome: 'Ração' });
        const r = await patch(a, insumo.id, { nome: 'ração' });
        expect(r.status).toBe(200);
        expect(r.body.data.nome).toBe('ração');
    });

    it('INS-PATCH-ID-08 tipoInsumoId atualizado para um inexistente/inativo', async () => {
        const insumo = await criarInsumo(propriedade.id, { tipoInsumoId: tipoInsumo.id });
        const tipoInativo = await criarTipoInsumo({ ativo: false });
        const r = await patch(a, insumo.id, { tipoInsumoId: tipoInativo.id });
        expect(r.status).toBe(404);
        expect(r.body.message).toBe('Tipo de insumo não encontrado.');
        expect(r.body.errors[0].path).toBe('tipoInsumoId');
    });

    it('INS-PATCH-ID-09 corpo vazio', async () => {
        const insumo = await criarInsumo(propriedade.id, { tipoInsumoId: tipoInsumo.id });
        const r = await patch(a, insumo.id, {});
        expect(r.status).toBe(400);
        expect(r.body.message).toBe('Forneça pelo menos um campo para atualizar.');
    });

    it('INS-PATCH-ID-10 campo extra no corpo (.strict())', async () => {
        const insumo = await criarInsumo(propriedade.id, { tipoInsumoId: tipoInsumo.id });
        const r = await patch(a, insumo.id, { extra: 1 });
        expect(r.status).toBe(400);
        expect(r.body.tipo).toBe('validationError');
    });

    it('INS-PATCH-ID-11 estoqueMinimo negativo', async () => {
        const insumo = await criarInsumo(propriedade.id, { tipoInsumoId: tipoInsumo.id });
        const r = await patch(a, insumo.id, { estoqueMinimo: -1 });
        expect(r.status).toBe(400);
        expect(r.body.tipo).toBe('validationError');
    });

    it('INS-PATCH-ID-12 id não é UUID', async () => {
        const r = await patch(a, 'nao-e-uuid', { nome: 'Novo' });
        expect(r.status).toBe(400);
        expect(r.body.tipo).toBe('validationError');
    });

    it('INS-PATCH-ID-13 sem token', async () => {
        const insumo = await criarInsumo(propriedade.id, { tipoInsumoId: tipoInsumo.id });
        const r = await api().patch(`/v1/insumos/${insumo.id}`).send({ nome: 'Novo' });
        expect(r.status).toBe(401);
        expect(r.body.tipo).toBe('unauthorized');
    });

    it('INS-PATCH-ID-14 id inexistente', async () => {
        const r = await patch(a, randomUUID(), { nome: 'Novo' });
        expect(r.status).toBe(404);
        expect(r.body.message).toBe('Recurso não encontrado em Insumo.');
    });

    it('INS-PATCH-ID-15 multi-tenancy: B atualiza id de um insumo de A', async () => {
        const insumo = await criarInsumo(propriedade.id, { tipoInsumoId: tipoInsumo.id, nome: 'De A' });
        const b = await criarUsuario();

        const r = await patch(b, insumo.id, { nome: 'Roubado' });
        expect(r.status).toBe(404);
        expect(r.body.message).toBe('Recurso não encontrado em Insumo.');
        const salvo = await DbConnect.prisma.insumo.findUnique({ where: { id: insumo.id } });
        expect(salvo.nome).toBe('De A');
    });
});
