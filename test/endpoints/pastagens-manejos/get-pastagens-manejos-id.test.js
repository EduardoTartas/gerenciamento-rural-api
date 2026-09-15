import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { api } from '../../apoio/cliente.js';
import { criarUsuario } from '../../apoio/auth.js';
import { criarPropriedade, criarPasto, criarTipoManejoPasto } from '../../apoio/fabricas.js';
import { criarManejoPasto } from './apoio-local.js';

describe('GET /v1/pastagens/manejos/:id', () => {
    let a, propriedade, pasto, tipoManejo;

    beforeEach(async () => {
        a = await criarUsuario();
        propriedade = await criarPropriedade(a.id);
        pasto = await criarPasto(propriedade.id);
        tipoManejo = await criarTipoManejoPasto();
    });

    const get = (usuario, id) =>
        api().get(`/v1/pastagens/manejos/${id}`).set('Authorization', usuario.bearer);

    it('MPAS-GET-ID-01 retorna manejo existente do usuário autenticado', async () => {
        const manejo = await criarManejoPasto(pasto.id, tipoManejo.id);
        const r = await get(a, manejo.id);
        expect(r.status).toBe(200);
        expect(r.body.message).toBe('Manejo de pasto encontrado com sucesso.');
        expect(r.body.data.itens).toBeDefined();
    });

    it('MPAS-GET-ID-02 manejo inativo (soft-deleted) ainda pode ser lido por id', async () => {
        const manejo = await criarManejoPasto(pasto.id, tipoManejo.id, { ativo: false });
        const r = await get(a, manejo.id);
        expect(r.status).toBe(200);
        expect(r.body.data.ativo).toBe(false);
    });

    it('MPAS-GET-ID-03 id inexistente', async () => {
        const r = await get(a, randomUUID());
        expect(r.status).toBe(404);
        expect(r.body.tipo).toBe('resourceNotFound');
        expect(r.body.message).toBe('Recurso não encontrado em Manejo de Pasto.');
    });

    it('MPAS-GET-ID-04 multi-tenancy: B tenta ler manejo de A', async () => {
        const manejo = await criarManejoPasto(pasto.id, tipoManejo.id);
        const b = await criarUsuario();
        const r = await get(b, manejo.id);
        expect(r.status).toBe(404);
        expect(r.body.tipo).toBe('resourceNotFound');
        expect(r.body.message).toBe('Recurso não encontrado em Manejo de Pasto.');
    });

    it('MPAS-GET-ID-05 :id não é UUID válido', async () => {
        const r = await get(a, 'nao-e-uuid');
        expect(r.status).toBe(400);
        expect(r.body.errors[0].message).toBe('ID de manejo de pasto inválido. Deve ser um UUID válido.');
    });

    it('MPAS-GET-ID-06 sem token', async () => {
        const manejo = await criarManejoPasto(pasto.id, tipoManejo.id);
        const r = await api().get(`/v1/pastagens/manejos/${manejo.id}`);
        expect(r.status).toBe(401);
        expect(r.body.tipo).toBe('unauthorized');
    });
});
