import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import DbConnect from '../../../src/config/dbConnect.js';
import { api } from '../../apoio/cliente.js';
import { criarUsuario } from '../../apoio/auth.js';
import { criarPropriedade, criarPasto, criarTipoManejoRebanho } from '../../apoio/fabricas.js';

describe('POST /v1/sync — ordenação, dependência e bloqueio', () => {
    let a, propriedade;

    beforeEach(async () => {
        a = await criarUsuario();
        propriedade = await criarPropriedade(a.id);
    });

    const sync = (usuario, mutacoes) =>
        api().post('/v1/sync').set('Authorization', usuario.bearer).send({ mutacoes });

    const resultadoDe = (r, id) => r.body.data.resultados.find((res) => res.id === id);

    it('SYNC-POST-15 mutações independentes mantêm a ordem de envio na resposta', async () => {
        const mutacoes = Array.from({ length: 3 }, () => ({
            id: randomUUID(),
            entidade: 'pastos',
            acao: 'CREATE',
            entidadeId: randomUUID(),
            dados: { propriedadeId: propriedade.id, nome: `Piquete ${randomUUID().slice(0, 6)}` },
        }));
        const r = await sync(a, mutacoes);
        expect(r.status).toBe(200);
        expect(r.body.data.resultados.map((res) => res.id)).toEqual(mutacoes.map((m) => m.id));
    });

    it('SYNC-POST-16 dependente é aplicado depois do predecessor mesmo enviado antes dele', async () => {
        const mutPasto = randomUUID();
        const mutRebanho = randomUUID();
        const idPasto = randomUUID();
        const idRebanho = randomUUID();

        const mRebanho = {
            id: mutRebanho, entidade: 'rebanhos', acao: 'CREATE', entidadeId: idRebanho,
            dependeDe: mutPasto,
            dados: { propriedadeId: propriedade.id, pastoAtualId: idPasto, nomeRebanho: 'Lote Sync' },
        };
        const mPasto = {
            id: mutPasto, entidade: 'pastos', acao: 'CREATE', entidadeId: idPasto,
            dados: { propriedadeId: propriedade.id, nome: 'Piquete Dependido' },
        };

        // Enviado com o rebanho ANTES do pasto do qual depende.
        const r = await sync(a, [mRebanho, mPasto]);
        expect(r.status).toBe(200);
        expect(resultadoDe(r, mutPasto).situacao).toBe('aceito');
        expect(resultadoDe(r, mutRebanho).situacao).toBe('aceito');
        // Preserva a ordem de ENVIO, não a de execução.
        expect(r.body.data.resultados.map((res) => res.id)).toEqual([mutRebanho, mutPasto]);

        const rebanhoSalvo = await DbConnect.prisma.rebanho.findUnique({ where: { id: idRebanho } });
        expect(rebanhoSalvo.pastoAtualId).toBe(idPasto);
    });

    it('SYNC-POST-17 cadeia de três níveis é resolvida (pasto → rebanho → manejo)', async () => {
        const tipoManejo = await criarTipoManejoRebanho();
        const mutPasto = randomUUID();
        const mutRebanho = randomUUID();
        const mutManejo = randomUUID();
        const idPasto = randomUUID();
        const idRebanho = randomUUID();
        const idManejo = randomUUID();

        const mManejo = {
            id: mutManejo, entidade: 'manejo_rebanhos', acao: 'CREATE', entidadeId: idManejo,
            dependeDe: mutRebanho,
            dados: { rebanhoId: idRebanho, tipoManejoId: tipoManejo.id, dataAtividade: '2026-01-01T00:00:00.000Z' },
        };
        const mRebanho = {
            id: mutRebanho, entidade: 'rebanhos', acao: 'CREATE', entidadeId: idRebanho,
            dependeDe: mutPasto,
            dados: { propriedadeId: propriedade.id, pastoAtualId: idPasto, nomeRebanho: 'Lote Cadeia' },
        };
        const mPasto = {
            id: mutPasto, entidade: 'pastos', acao: 'CREATE', entidadeId: idPasto,
            dados: { propriedadeId: propriedade.id, nome: 'Piquete Cadeia' },
        };

        // Enviados fora de ordem: manejo, rebanho, pasto.
        const r = await sync(a, [mManejo, mRebanho, mPasto]);
        expect(r.status).toBe(200);
        expect(resultadoDe(r, mutPasto).situacao).toBe('aceito');
        expect(resultadoDe(r, mutRebanho).situacao).toBe('aceito');
        expect(resultadoDe(r, mutManejo).situacao).toBe('aceito');

        const manejoSalvo = await DbConnect.prisma.manejoRebanho.findUnique({ where: { id: idManejo } });
        expect(manejoSalvo.rebanhoId).toBe(idRebanho);
        const rebanhoSalvo = await DbConnect.prisma.rebanho.findUnique({ where: { id: idRebanho } });
        expect(rebanhoSalvo.pastoAtualId).toBe(idPasto);
    });

    it('SYNC-POST-18 dependeDe aponta para fora do lote', async () => {
        const foraDoLote = randomUUID();
        const m = {
            id: randomUUID(), entidade: 'pastos', acao: 'CREATE', entidadeId: randomUUID(),
            dependeDe: foraDoLote,
            dados: { propriedadeId: propriedade.id, nome: 'Piquete' },
        };
        const r = await sync(a, [m]);
        expect(r.status).toBe(400);
        expect(r.body.errors[0].message).toContain(m.id);
        expect(r.body.errors[0].message).toContain(foraDoLote);

        const aplicadas = await DbConnect.prisma.mutacaoAplicada.count();
        expect(aplicadas).toBe(0);
    });

    it('SYNC-POST-19 ciclo direto de dependência (A depende de B, B depende de A)', async () => {
        const idA = randomUUID();
        const idB = randomUUID();
        const mA = {
            id: idA, entidade: 'pastos', acao: 'CREATE', entidadeId: randomUUID(), dependeDe: idB,
            dados: { propriedadeId: propriedade.id, nome: 'A' },
        };
        const mB = {
            id: idB, entidade: 'pastos', acao: 'CREATE', entidadeId: randomUUID(), dependeDe: idA,
            dados: { propriedadeId: propriedade.id, nome: 'B' },
        };
        const r = await sync(a, [mA, mB]);
        expect(r.status).toBe(400);
        expect(r.body.errors[0].message).toContain('Ciclo');

        const aplicadas = await DbConnect.prisma.mutacaoAplicada.count();
        expect(aplicadas).toBe(0);
    });

    it('SYNC-POST-20 ciclo indireto de três mutações', async () => {
        const idA = randomUUID();
        const idB = randomUUID();
        const idC = randomUUID();
        const mA = {
            id: idA, entidade: 'pastos', acao: 'CREATE', entidadeId: randomUUID(), dependeDe: idB,
            dados: { propriedadeId: propriedade.id, nome: 'A' },
        };
        const mB = {
            id: idB, entidade: 'pastos', acao: 'CREATE', entidadeId: randomUUID(), dependeDe: idC,
            dados: { propriedadeId: propriedade.id, nome: 'B' },
        };
        const mC = {
            id: idC, entidade: 'pastos', acao: 'CREATE', entidadeId: randomUUID(), dependeDe: idA,
            dados: { propriedadeId: propriedade.id, nome: 'C' },
        };
        const r = await sync(a, [mA, mB, mC]);
        expect(r.status).toBe(400);
        expect(r.body.errors[0].message).toContain('Ciclo');
    });

    it('SYNC-POST-21 mutação recusada bloqueia quem depende dela', async () => {
        await criarPasto(propriedade.id, { nome: 'Duplicado' });
        const idPasto = randomUUID();
        const idRebanho = randomUUID();
        const mutPasto = randomUUID();
        const mutRebanho = randomUUID();

        const mPasto = {
            id: mutPasto, entidade: 'pastos', acao: 'CREATE', entidadeId: idPasto,
            dados: { propriedadeId: propriedade.id, nome: 'Duplicado' },
        };
        const mRebanho = {
            id: mutRebanho, entidade: 'rebanhos', acao: 'CREATE', entidadeId: idRebanho,
            dependeDe: mutPasto,
            dados: { propriedadeId: propriedade.id, pastoAtualId: idPasto, nomeRebanho: 'Lote' },
        };

        const r = await sync(a, [mPasto, mRebanho]);
        expect(r.status).toBe(200);
        expect(resultadoDe(r, mutPasto)).toMatchObject({ situacao: 'recusado' });
        expect(resultadoDe(r, mutPasto).erro.tipo).toBe('conflict');
        expect(resultadoDe(r, mutRebanho)).toMatchObject({ situacao: 'bloqueado', bloqueadoPor: mutPasto });

        const rebanhoSalvo = await DbConnect.prisma.rebanho.findUnique({ where: { id: idRebanho } });
        expect(rebanhoSalvo).toBeNull();
    });

    it('SYNC-POST-22 bloqueio se propaga em cadeia (recusa no nível 1 bloqueia níveis 2 e 3)', async () => {
        const tipoManejo = await criarTipoManejoRebanho();
        await criarPasto(propriedade.id, { nome: 'Duplicado Cadeia' });

        const idPasto = randomUUID();
        const idRebanho = randomUUID();
        const idManejo = randomUUID();
        const mutPasto = randomUUID();
        const mutRebanho = randomUUID();
        const mutManejo = randomUUID();

        const mPasto = {
            id: mutPasto, entidade: 'pastos', acao: 'CREATE', entidadeId: idPasto,
            dados: { propriedadeId: propriedade.id, nome: 'Duplicado Cadeia' },
        };
        const mRebanho = {
            id: mutRebanho, entidade: 'rebanhos', acao: 'CREATE', entidadeId: idRebanho,
            dependeDe: mutPasto,
            dados: { propriedadeId: propriedade.id, pastoAtualId: idPasto, nomeRebanho: 'Lote Cadeia Bloqueio' },
        };
        const mManejo = {
            id: mutManejo, entidade: 'manejo_rebanhos', acao: 'CREATE', entidadeId: idManejo,
            dependeDe: mutRebanho,
            dados: { rebanhoId: idRebanho, tipoManejoId: tipoManejo.id, dataAtividade: '2026-01-01T00:00:00.000Z' },
        };

        const r = await sync(a, [mPasto, mRebanho, mManejo]);
        expect(r.status).toBe(200);
        expect(resultadoDe(r, mutPasto).situacao).toBe('recusado');
        expect(resultadoDe(r, mutRebanho)).toMatchObject({ situacao: 'bloqueado', bloqueadoPor: mutPasto });
        expect(resultadoDe(r, mutManejo)).toMatchObject({ situacao: 'bloqueado', bloqueadoPor: mutPasto });
    });

    it('SYNC-POST-23 mutação independente entra mesmo com outra recusada no mesmo lote', async () => {
        await criarPasto(propriedade.id, { nome: 'Já Existe' });
        const mDuplicada = {
            id: randomUUID(), entidade: 'pastos', acao: 'CREATE', entidadeId: randomUUID(),
            dados: { propriedadeId: propriedade.id, nome: 'Já Existe' },
        };
        const mIndependente = {
            id: randomUUID(), entidade: 'pastos', acao: 'CREATE', entidadeId: randomUUID(),
            dados: { propriedadeId: propriedade.id, nome: 'Nova' },
        };

        const r = await sync(a, [mDuplicada, mIndependente]);
        expect(r.status).toBe(200);
        expect(resultadoDe(r, mDuplicada.id).situacao).toBe('recusado');
        expect(resultadoDe(r, mIndependente.id).situacao).toBe('aceito');

        const salvo = await DbConnect.prisma.pasto.findUnique({ where: { id: mIndependente.entidadeId } });
        expect(salvo).not.toBeNull();
    });
});
