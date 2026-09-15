import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import DbConnect from '../../../src/config/dbConnect.js';
import { api } from '../../apoio/cliente.js';
import { criarUsuario } from '../../apoio/auth.js';
import { criarPropriedade, criarPasto, criarInsumo, criarTipoManejoPasto } from '../../apoio/fabricas.js';
import { criarManejoPasto } from './apoio-local.js';

describe('DELETE /v1/pastagens/manejos/:id', () => {
    let a, propriedade, pasto, tipoManejo;

    beforeEach(async () => {
        a = await criarUsuario();
        propriedade = await criarPropriedade(a.id);
        pasto = await criarPasto(propriedade.id);
        tipoManejo = await criarTipoManejoPasto();
    });

    const del = (usuario, id) =>
        api().delete(`/v1/pastagens/manejos/${id}`).set('Authorization', usuario.bearer);

    it('MPAS-DELETE-ID-01 exclui manejo sem itens', async () => {
        const manejo = await criarManejoPasto(pasto.id, tipoManejo.id);
        const r = await del(a, manejo.id);
        expect(r.status).toBe(200);

        const salvo = await DbConnect.prisma.manejoPasto.findUnique({ where: { id: manejo.id } });
        expect(salvo).not.toBeNull();
        expect(salvo.ativo).toBe(false);
    });

    it('MPAS-DELETE-ID-02 exclui manejo com itens de insumo vinculados', async () => {
        const manejo = await criarManejoPasto(pasto.id, tipoManejo.id);
        const insumo = await criarInsumo(propriedade.id, { destino: 'Pasto' });
        const mov = await DbConnect.prisma.movimentacaoInsumo.create({
            data: {
                insumoId: insumo.id,
                tipo: 'Saida',
                quantidade: 5,
                data: new Date(),
                origem: 'ManejoPasto',
                manejoPastoId: manejo.id,
                pastoId: pasto.id,
            },
        });

        const r = await del(a, manejo.id);
        expect(r.status).toBe(200);

        const movSalva = await DbConnect.prisma.movimentacaoInsumo.findUnique({ where: { id: mov.id } });
        expect(movSalva.ativo).toBe(false);
    });

    it('MPAS-DELETE-ID-03 id inexistente', async () => {
        const r = await del(a, randomUUID());
        expect(r.status).toBe(404);
        expect(r.body.tipo).toBe('resourceNotFound');
    });

    it('MPAS-DELETE-ID-04 multi-tenancy: B tenta excluir manejo de A', async () => {
        const manejo = await criarManejoPasto(pasto.id, tipoManejo.id);
        const b = await criarUsuario();
        const r = await del(b, manejo.id);
        expect(r.status).toBe(404);
        expect(r.body.tipo).toBe('resourceNotFound');

        const salvo = await DbConnect.prisma.manejoPasto.findUnique({ where: { id: manejo.id } });
        expect(salvo.ativo).toBe(true);
    });

    it('MPAS-DELETE-ID-05 :id não é UUID válido', async () => {
        const r = await del(a, 'nao-e-uuid');
        expect(r.status).toBe(400);
        expect(r.body.errors[0].message).toBe('ID de manejo de pasto inválido. Deve ser um UUID válido.');
    });

    it('MPAS-DELETE-ID-06 sem token', async () => {
        const manejo = await criarManejoPasto(pasto.id, tipoManejo.id);
        const r = await api().delete(`/v1/pastagens/manejos/${manejo.id}`);
        expect(r.status).toBe(401);
        expect(r.body.tipo).toBe('unauthorized');
    });
});
