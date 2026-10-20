import { describe, expect, it } from 'vitest';
import { api } from '../../apoio/cliente.js';
import { criarUsuario } from '../../apoio/auth.js';
import { criarPropriedade, criarPasto } from '../../apoio/fabricas.js';

describe('Versão do registro na leitura', () => {
    it('VER-GET-01 leitura por id e listagem devolvem a versão do pasto', async () => {
        const a = await criarUsuario();
        const propriedade = await criarPropriedade(a.id);
        const pasto = await criarPasto(propriedade.id);

        await api().patch(`/v1/pastagens/${pasto.id}`).set('Authorization', a.bearer).send({ nome: 'Renomeado' });

        const um = await api().get(`/v1/pastagens/${pasto.id}`).set('Authorization', a.bearer);
        expect(um.body.data.versao).toBe(2);

        const lista = await api().get('/v1/pastagens').set('Authorization', a.bearer);
        expect(lista.body.data.docs[0].versao).toBe(2);
    });
});
