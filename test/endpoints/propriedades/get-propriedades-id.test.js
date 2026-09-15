import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { api } from '../../apoio/cliente.js';
import { criarUsuario } from '../../apoio/auth.js';
import { criarPropriedade } from '../../apoio/fabricas.js';

describe('GET /v1/propriedades/:id', () => {
    let a;
    beforeEach(async () => { a = await criarUsuario(); });

    const get = (usuario, id) =>
        api().get(`/v1/propriedades/${id}`).set('Authorization', usuario.bearer);

    it('PROP-GET-ID-01 retorna propriedade existente do usuário autenticado', async () => {
        const propriedade = await criarPropriedade(a.id);
        const r = await get(a, propriedade.id);
        expect(r.status).toBe(200);
        expect(r.body.message).toBe('Propriedade encontrada com sucesso.');
        expect(r.body.data.usuario).toMatchObject({ id: a.id });
        expect(r.body.data.usuario.email).toBeDefined();
        expect(r.body.data.usuario.name).toBeDefined();
    });

    it('PROP-GET-ID-02 propriedade inativa (soft-deleted) do próprio dono ainda pode ser lida por id', async () => {
        const propriedade = await criarPropriedade(a.id, { ativo: false });
        const r = await get(a, propriedade.id);
        expect(r.status).toBe(200);
        expect(r.body.data.ativo).toBe(false);
    });

    it('PROP-GET-ID-03 id inexistente (UUID válido, sem registro)', async () => {
        const r = await get(a, randomUUID());
        expect(r.status).toBe(404);
        expect(r.body.tipo).toBe('resourceNotFound');
        expect(r.body.message).toBe('Recurso não encontrado em Propriedade.');
    });

    it('PROP-GET-ID-04 multi-tenancy: B tenta ler propriedade de A', async () => {
        const b = await criarUsuario();
        const propriedade = await criarPropriedade(a.id);
        const r = await get(b, propriedade.id);
        expect(r.status).toBe(404);
        expect(r.body.tipo).toBe('resourceNotFound');
        expect(r.body.message).toBe('Recurso não encontrado em Propriedade.');
    });

    it('PROP-GET-ID-05 :id não é UUID válido', async () => {
        const r = await get(a, 'nao-uuid');
        expect(r.status).toBe(400);
        expect(r.body.tipo).toBe('validationError');
        expect(r.body.errors[0].message).toBe('ID de propriedade inválido. Deve ser um UUID válido.');
    });

    it('PROP-GET-ID-06 sem token', async () => {
        const propriedade = await criarPropriedade(a.id);
        const r = await api().get(`/v1/propriedades/${propriedade.id}`);
        expect(r.status).toBe(401);
        expect(r.body.tipo).toBe('unauthorized');
    });

    it('PROP-GET-ID-07 token inválido', async () => {
        const propriedade = await criarPropriedade(a.id);
        const r = await api()
            .get(`/v1/propriedades/${propriedade.id}`)
            .set('Authorization', 'Bearer token-invalido');
        expect(r.status).toBe(401);
        expect(r.body.tipo).toBe('unauthorized');
    });
});
