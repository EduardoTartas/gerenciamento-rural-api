import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import DbConnect from '../../../src/config/dbConnect.js';
import { api } from '../../apoio/cliente.js';
import { criarUsuario } from '../../apoio/auth.js';
import { criarPropriedade, criarPasto } from '../../apoio/fabricas.js';

describe('POST /v1/sync — multi-tenancy dentro das mutações e autenticação', () => {
    let a, propriedadeA, pastoA;

    beforeEach(async () => {
        a = await criarUsuario();
        propriedadeA = await criarPropriedade(a.id);
        pastoA = await criarPasto(propriedadeA.id);
    });

    const sync = (usuario, mutacoes) =>
        api().post('/v1/sync').set('Authorization', usuario.bearer).send({ mutacoes });

    it('SYNC-POST-71 UPDATE em recurso de outro usuário é recusado como não encontrado', async () => {
        const b = await criarUsuario();
        const m = {
            id: randomUUID(), entidade: 'pastos', acao: 'UPDATE', entidadeId: pastoA.id,
            dados: { nome: 'Invadido' },
        };
        const r = await sync(b, [m]);
        const res = r.body.data.resultados[0];
        expect(res.situacao).toBe('recusado');
        expect(res.erro.tipo).toBe('resourceNotFound');

        const pastoAtual = await DbConnect.prisma.pasto.findUnique({ where: { id: pastoA.id } });
        expect(pastoAtual.nome).toBe(pastoA.nome);
    });

    it('SYNC-POST-72 DELETE em recurso de outro usuário é recusado como não encontrado', async () => {
        const b = await criarUsuario();
        const m = { id: randomUUID(), entidade: 'pastos', acao: 'DELETE', entidadeId: pastoA.id };
        const r = await sync(b, [m]);
        const res = r.body.data.resultados[0];
        expect(res.situacao).toBe('recusado');
        expect(res.erro.tipo).toBe('resourceNotFound');

        const pastoAtual = await DbConnect.prisma.pasto.findUnique({ where: { id: pastoA.id } });
        expect(pastoAtual.ativo).toBe(true);
    });

    it('SYNC-POST-73 CREATE com propriedadeId de outro usuário é recusado', async () => {
        const b = await criarUsuario();
        const entidadeId = randomUUID();
        const m = {
            id: randomUUID(), entidade: 'pastos', acao: 'CREATE', entidadeId,
            dados: { propriedadeId: propriedadeA.id, nome: 'Invasor' },
        };
        const r = await sync(b, [m]);
        const res = r.body.data.resultados[0];
        expect(res.situacao).toBe('recusado');
        expect(res.erro.tipo).toBe('resourceNotFound');

        const pastoCriado = await DbConnect.prisma.pasto.findUnique({ where: { id: entidadeId } });
        expect(pastoCriado).toBeNull();
    });

    it('SYNC-POST-74 mutações de A e B em lotes separados não se enxergam', async () => {
        const b = await criarUsuario();
        const propriedadeB = await criarPropriedade(b.id);

        const mA = {
            id: randomUUID(), entidade: 'pastos', acao: 'CREATE', entidadeId: randomUUID(),
            dados: { propriedadeId: propriedadeA.id, nome: 'Pasto de A no lote' },
        };
        const rA = await sync(a, [mA]);
        expect(rA.body.data.resultados[0].situacao).toBe('aceito');

        // B, num lote separado, tenta mexer no pasto de A e também cria o seu.
        const mInvasao = {
            id: randomUUID(), entidade: 'pastos', acao: 'UPDATE', entidadeId: pastoA.id,
            dados: { nome: 'Tentativa de B' },
        };
        const mProprioDeB = {
            id: randomUUID(), entidade: 'pastos', acao: 'CREATE', entidadeId: randomUUID(),
            dados: { propriedadeId: propriedadeB.id, nome: 'Pasto de B' },
        };
        const rB = await sync(b, [mInvasao, mProprioDeB]);
        expect(rB.status).toBe(200);
        const resInvasao = rB.body.data.resultados.find((x) => x.id === mInvasao.id);
        const resProprio = rB.body.data.resultados.find((x) => x.id === mProprioDeB.id);
        expect(resInvasao.situacao).toBe('recusado');
        expect(resProprio.situacao).toBe('aceito');

        const pastoAtualDeA = await DbConnect.prisma.pasto.findUnique({ where: { id: pastoA.id } });
        expect(pastoAtualDeA.nome).toBe(pastoA.nome);
        const pastoDeB = await DbConnect.prisma.pasto.findUnique({ where: { id: mProprioDeB.entidadeId } });
        expect(pastoDeB.propriedadeId).toBe(propriedadeB.id);
    });

    it('SYNC-POST-75 401 sem token', async () => {
        const m = {
            id: randomUUID(), entidade: 'pastos', acao: 'CREATE', entidadeId: randomUUID(),
            dados: { propriedadeId: propriedadeA.id, nome: 'Sem Token' },
        };
        const r = await api().post('/v1/sync').send({ mutacoes: [m] });
        expect(r.status).toBe(401);
        expect(r.body.tipo).toBe('unauthorized');

        const aplicadas = await DbConnect.prisma.mutacaoAplicada.count();
        expect(aplicadas).toBe(0);
    });

    it('SYNC-POST-76 401 com token inválido/expirado', async () => {
        const m = {
            id: randomUUID(), entidade: 'pastos', acao: 'CREATE', entidadeId: randomUUID(),
            dados: { propriedadeId: propriedadeA.id, nome: 'Token Inválido' },
        };
        const r = await api()
            .post('/v1/sync')
            .set('Authorization', 'Bearer token-invalido')
            .send({ mutacoes: [m] });
        expect(r.status).toBe(401);
        expect(r.body.tipo).toBe('unauthorized');
    });
});
