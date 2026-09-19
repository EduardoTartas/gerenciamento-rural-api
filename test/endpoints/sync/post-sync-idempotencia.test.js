import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import DbConnect from '../../../src/config/dbConnect.js';
import { api } from '../../apoio/cliente.js';
import { criarUsuario } from '../../apoio/auth.js';
import { criarPropriedade, criarPasto, criarRebanho } from '../../apoio/fabricas.js';
import { criarMutacaoAplicada } from './apoio-local.js';

describe('POST /v1/sync — idempotência', () => {
    let a, propriedade, pastoOrigem, pastoDestino, rebanho;

    beforeEach(async () => {
        a = await criarUsuario();
        propriedade = await criarPropriedade(a.id);
        pastoOrigem = await criarPasto(propriedade.id, { status: 'Ocupado' });
        pastoDestino = await criarPasto(propriedade.id, { status: 'Vazio' });
        rebanho = await criarRebanho(propriedade.id, pastoOrigem.id);
    });

    const sync = (usuario, mutacoes) =>
        api().post('/v1/sync').set('Authorization', usuario.bearer).send({ mutacoes });

    it('SYNC-POST-24 reenvio do mesmo id de mutação já aceita devolve o resultado gravado, sem duplicar', async () => {
        const movId = randomUUID();
        const m = {
            id: randomUUID(), entidade: 'historico_movimentacoes', acao: 'CREATE', entidadeId: movId,
            dados: { rebanhoId: rebanho.id, pastoDestinoId: pastoDestino.id },
        };

        const primeira = await sync(a, [m]);
        expect(primeira.status).toBe(200);
        expect(primeira.body.data.resultados[0].situacao).toBe('aceito');

        const segunda = await sync(a, [m]);
        expect(segunda.status).toBe(200);
        expect(segunda.body.data.resultados[0]).toEqual(primeira.body.data.resultados[0]);

        const total = await DbConnect.prisma.historicoMovimentacao.count({ where: { id: movId } });
        expect(total).toBe(1);
    });

    it('SYNC-POST-25 idempotência é escopada por usuário', async () => {
        const b = await criarUsuario();
        const propriedadeB = await criarPropriedade(b.id);
        const mutacaoId = randomUUID();
        const idPastoA = randomUUID();
        const idPastoB = randomUUID();

        const mA = {
            id: mutacaoId, entidade: 'pastos', acao: 'CREATE', entidadeId: idPastoA,
            dados: { propriedadeId: propriedade.id, nome: 'Pasto de A' },
        };
        const rA = await sync(a, [mA]);
        expect(rA.status).toBe(200);
        expect(rA.body.data.resultados[0].situacao).toBe('aceito');

        // B envia uma mutação com o MESMO id de mutação, mas outro entidadeId/dados.
        const mB = {
            id: mutacaoId, entidade: 'pastos', acao: 'CREATE', entidadeId: idPastoB,
            dados: { propriedadeId: propriedadeB.id, nome: 'Pasto de B' },
        };
        const rB = await sync(b, [mB]);
        expect(rB.status).toBe(200);
        expect(rB.body.data.resultados[0]).toMatchObject({ situacao: 'aceito', entidadeId: idPastoB });

        const pastoB = await DbConnect.prisma.pasto.findUnique({ where: { id: idPastoB } });
        expect(pastoB).not.toBeNull();
        expect(pastoB.propriedadeId).toBe(propriedadeB.id);

        const registros = await DbConnect.prisma.mutacaoAplicada.findMany({ where: { id: mutacaoId } });
        expect(registros).toHaveLength(2);
        expect(registros.map((r) => r.usuarioId).sort()).toEqual([a.id, b.id].sort());
    });

    it('SYNC-POST-26 registro de idempotência expira após a janela de retenção', async () => {
        const mutacaoId = randomUUID();
        const idPasto = randomUUID();

        await criarMutacaoAplicada(a.id, {
            id: mutacaoId,
            diasAtras: 31,
            entidade: 'pastos',
            entidadeId: randomUUID(),
            resultado: { id: mutacaoId, situacao: 'aceito', entidade: 'pastos', entidadeId: randomUUID(), dados: { nome: 'Registro Velho' } },
        });

        const m = {
            id: mutacaoId, entidade: 'pastos', acao: 'CREATE', entidadeId: idPasto,
            dados: { propriedadeId: propriedade.id, nome: 'Reenvio Após Expirar' },
        };
        const r = await sync(a, [m]);
        expect(r.status).toBe(200);
        expect(r.body.data.resultados[0].situacao).toBe('aceito');
        expect(r.body.data.resultados[0].entidadeId).toBe(idPasto);

        const pasto = await DbConnect.prisma.pasto.findUnique({ where: { id: idPasto } });
        expect(pasto).not.toBeNull();

        const registro = await DbConnect.prisma.mutacaoAplicada.findUnique({ where: { id_usuarioId: { id: mutacaoId, usuarioId: a.id } } });
        expect(registro.entidadeId).toBe(idPasto);
    });
});
