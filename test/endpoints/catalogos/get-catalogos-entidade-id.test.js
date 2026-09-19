import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { api } from '../../apoio/cliente.js';
import { criarUsuario } from '../../apoio/auth.js';
import { criarRaca } from '../../apoio/fabricas.js';

describe('GET /v1/catalogos/:entidade/:id', () => {
    let a;

    beforeEach(async () => {
        a = await criarUsuario();
    });

    const get = (usuario, entidade, id) =>
        api().get(`/v1/catalogos/${entidade}/${id}`).set('Authorization', usuario.bearer);

    it('CAT-GET-ID-01 busca item existente por ID', async () => {
        const raca = await criarRaca({ nome: 'Nelore' });
        const r = await get(a, 'racas', raca.id);
        expect(r.status).toBe(200);
        expect(r.body.data.id).toBe(raca.id);
        expect(r.body.data.nome).toBe('Nelore');
        expect(r.body.message).toBe('Nelore encontrado(a) com sucesso.');
    });

    // CAT-GET-ID-02: CatalogoRepository.findById não filtra por `ativo` — divergência
    // registrada no .md. GET por ID encontra itens arquivados normalmente.
    it('CAT-GET-ID-02 item inativo também é encontrado por ID', async () => {
        const raca = await criarRaca({ nome: 'Nelore Inativa', ativo: false });
        const r = await get(a, 'racas', raca.id);
        expect(r.status).toBe(200);
        expect(r.body.data.ativo).toBe(false);
    });

    it('CAT-GET-ID-03 ID em formato inválido (não UUID)', async () => {
        const r = await get(a, 'racas', 'abc');
        expect(r.status).toBe(400);
        expect(r.body.tipo).toBe('validationError');
    });

    it('CAT-GET-ID-04 UUID válido mas inexistente', async () => {
        const r = await get(a, 'racas', randomUUID());
        expect(r.status).toBe(404);
        expect(r.body.tipo).toBe('resourceNotFound');
        expect(r.body.message).toBe('Recurso não encontrado em Raça.');
    });

    it('CAT-GET-ID-05 :entidade inexistente com :id válido', async () => {
        const r = await get(a, 'nao-existe', randomUUID());
        expect(r.status).toBe(404);
        expect(r.body.tipo).toBe('resourceNotFound');
    });

    it('CAT-GET-ID-06 401 sem token', async () => {
        const raca = await criarRaca({ nome: 'Nelore' });
        const r = await api().get(`/v1/catalogos/racas/${raca.id}`);
        expect(r.status).toBe(401);
        expect(r.body.tipo).toBe('unauthorized');
    });

    it('CAT-GET-ID-07 leitura por ID não exige admin', async () => {
        const raca = await criarRaca({ nome: 'Nelore' });
        const r = await get(a, 'racas', raca.id);
        expect(r.status).toBe(200);
        expect(r.body.data.id).toBe(raca.id);
    });
});
