import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import DbConnect from '../../../src/config/dbConnect.js';
import { api } from '../../apoio/cliente.js';
import { criarUsuario } from '../../apoio/auth.js';
import { criarPropriedade, criarPasto } from '../../apoio/fabricas.js';

describe('POST /v1/sync — conflito de edição por versão', () => {
    let a, propriedade, pasto;

    beforeEach(async () => {
        a = await criarUsuario();
        propriedade = await criarPropriedade(a.id);
        pasto = await criarPasto(propriedade.id, { nome: 'Pasto original' });
    });

    const sync = (usuario, mutacoes) =>
        api().post('/v1/sync').set('Authorization', usuario.bearer).send({ mutacoes });

    const editar = (entidadeId, dados, extra = {}) => ({
        id: randomUUID(), entidade: 'pastos', acao: 'UPDATE', entidadeId, dados, ...extra,
    });

    // Outro cliente editando o mesmo pasto pelo REST (o que sobe a versão no servidor).
    const editarPeloRest = (nome) =>
        api().patch(`/v1/pastagens/${pasto.id}`).set('Authorization', a.bearer).send({ nome });

    const nomeNoBanco = async () =>
        (await DbConnect.prisma.pasto.findUnique({ where: { id: pasto.id } })).nome;

    it('SYNC-POST-VER-01 registro novo nasce na versão 1 e o CREATE devolve a versão', async () => {
        const id = randomUUID();
        const r = await sync(a, [{
            id: randomUUID(), entidade: 'pastos', acao: 'CREATE', entidadeId: id,
            dados: { propriedadeId: propriedade.id, nome: 'Novo' },
        }]);
        expect(r.status).toBe(200);
        expect(r.body.data.resultados[0]).toMatchObject({ situacao: 'aceito', dados: { id, versao: 1 } });
    });

    it('SYNC-POST-VER-02 UPDATE com a versão base atual é aceito e sobe a versão', async () => {
        const r = await sync(a, [editar(pasto.id, { nome: 'Editado' }, { versaoBase: 1 })]);
        expect(r.status).toBe(200);
        expect(r.body.data.resultados[0]).toMatchObject({ situacao: 'aceito', dados: { nome: 'Editado', versao: 2 } });
        expect(await nomeNoBanco()).toBe('Editado');
    });

    it('SYNC-POST-VER-03 UPDATE com versão base antiga vira conflito e não altera o registro', async () => {
        const rest = await editarPeloRest('Edição do outro cliente');
        expect(rest.status).toBe(200);
        expect(rest.body.data.versao).toBe(2);

        const mutacao = editar(pasto.id, { nome: 'Edição do aparelho' }, { versaoBase: 1 });
        const r = await sync(a, [mutacao]);

        expect(r.status).toBe(200);
        expect(r.body.data.resultados[0]).toEqual({
            id: mutacao.id,
            situacao: 'conflito',
            entidade: 'pastos',
            entidadeId: pasto.id,
            versaoBase: 1,
            versaoServidor: 2,
            erro: {
                tipo: 'conflict',
                campo: 'versaoBase',
                mensagem: expect.stringContaining('foi alterado'),
                recuperavel: false,
            },
        });
        expect(await nomeNoBanco()).toBe('Edição do outro cliente');
    });

    it('SYNC-POST-VER-04 UPDATE sem versão base continua sendo aplicado (compatibilidade)', async () => {
        await editarPeloRest('Edição do outro cliente');
        const r = await sync(a, [editar(pasto.id, { nome: 'Do aparelho antigo' })]);
        expect(r.body.data.resultados[0]).toMatchObject({ situacao: 'aceito', dados: { versao: 3 } });
        expect(await nomeNoBanco()).toBe('Do aparelho antigo');
    });

    it('SYNC-POST-VER-05 reenvio de mutação aceita não vira conflito e devolve o mesmo resultado', async () => {
        const mutacao = editar(pasto.id, { nome: 'Editado' }, { versaoBase: 1 });
        const primeira = await sync(a, [mutacao]);
        expect(primeira.body.data.resultados[0].situacao).toBe('aceito');

        const segunda = await sync(a, [mutacao]);
        expect(segunda.body.data.resultados[0]).toEqual(primeira.body.data.resultados[0]);

        const registro = await DbConnect.prisma.pasto.findUnique({ where: { id: pasto.id } });
        expect(registro.versao).toBe(2);
    });

    it('SYNC-POST-VER-06 reenvio de mutação em conflito continua em conflito e não é registrado como aplicado', async () => {
        await editarPeloRest('Edição do outro cliente');
        const mutacao = editar(pasto.id, { nome: 'Edição do aparelho' }, { versaoBase: 1 });

        const primeira = await sync(a, [mutacao]);
        const segunda = await sync(a, [mutacao]);

        expect(primeira.body.data.resultados[0].situacao).toBe('conflito');
        expect(segunda.body.data.resultados[0]).toEqual(primeira.body.data.resultados[0]);
        expect(await DbConnect.prisma.mutacaoAplicada.count({ where: { id: mutacao.id } })).toBe(0);
    });

    it('SYNC-POST-VER-07 escolher manter a do aparelho: reenviar com a versão do servidor aplica', async () => {
        await editarPeloRest('Edição do outro cliente');
        const conflito = await sync(a, [editar(pasto.id, { nome: 'Do aparelho' }, { versaoBase: 1 })]);
        const { versaoServidor } = conflito.body.data.resultados[0];

        const r = await sync(a, [editar(pasto.id, { nome: 'Do aparelho' }, { versaoBase: versaoServidor })]);
        expect(r.body.data.resultados[0]).toMatchObject({ situacao: 'aceito', dados: { nome: 'Do aparelho', versao: 3 } });
    });

    it('SYNC-POST-VER-08 conflito bloqueia as mutações que dependem dela', async () => {
        await editarPeloRest('Edição do outro cliente');
        const edicao = editar(pasto.id, { nome: 'Do aparelho' }, { versaoBase: 1 });
        const dependente = {
            id: randomUUID(), entidade: 'pastos', acao: 'CREATE', entidadeId: randomUUID(),
            dados: { propriedadeId: propriedade.id, nome: 'Depende da edição' }, dependeDe: edicao.id,
        };

        const r = await sync(a, [edicao, dependente]);

        expect(r.body.data.resultados[0].situacao).toBe('conflito');
        expect(r.body.data.resultados[1]).toMatchObject({ situacao: 'bloqueado', bloqueadoPor: edicao.id });
        expect(await DbConnect.prisma.pasto.count({ where: { id: dependente.entidadeId } })).toBe(0);
    });

    it('SYNC-POST-VER-09 conflito de um item não impede os demais do lote', async () => {
        await editarPeloRest('Edição do outro cliente');
        const outro = await criarPasto(propriedade.id, { nome: 'Outro pasto' });

        const r = await sync(a, [
            editar(pasto.id, { nome: 'Do aparelho' }, { versaoBase: 1 }),
            editar(outro.id, { nome: 'Outro editado' }, { versaoBase: 1 }),
        ]);

        expect(r.body.data.resultados.map((x) => x.situacao)).toEqual(['conflito', 'aceito']);
    });

    it('SYNC-POST-VER-10 duas edições do mesmo registro no lote: a segunda parte da versão que a primeira gerou', async () => {
        const r = await sync(a, [
            editar(pasto.id, { nome: 'Primeira' }, { versaoBase: 1 }),
            editar(pasto.id, { nome: 'Segunda' }, { versaoBase: 2 }),
        ]);
        expect(r.body.data.resultados.map((x) => x.situacao)).toEqual(['aceito', 'aceito']);
        expect(await nomeNoBanco()).toBe('Segunda');
    });

    it('SYNC-POST-VER-11 versão base de registro de outro usuário não revela nada: segue a recusa de sempre', async () => {
        const b = await criarUsuario();
        const r = await sync(b, [editar(pasto.id, { nome: 'Invasão' }, { versaoBase: 99 })]);
        expect(r.body.data.resultados[0]).toMatchObject({ situacao: 'recusado' });
        expect(r.body.data.resultados[0].versaoServidor).toBeUndefined();
    });

    it('SYNC-POST-VER-12 versão base inválida recusa o lote com 400', async () => {
        for (const versaoBase of [0, -1, 1.5, 'abc']) {
            const r = await sync(a, [editar(pasto.id, { nome: 'X' }, { versaoBase })]);
            expect(r.status).toBe(400);
        }
    });

    it('SYNC-POST-VER-13 DELETE ignora a versão base', async () => {
        const r = await sync(a, [{
            id: randomUUID(), entidade: 'pastos', acao: 'DELETE', entidadeId: pasto.id, versaoBase: 99,
        }]);
        expect(r.body.data.resultados[0].situacao).toBe('aceito');
    });

    it('SYNC-POST-VER-15 dois lotes simultâneos na mesma versão base: um aplica e o outro é conflito', async () => {
        const [r1, r2] = await Promise.all([
            sync(a, [editar(pasto.id, { nome: 'Lote 1' }, { versaoBase: 1 })]),
            sync(a, [editar(pasto.id, { nome: 'Lote 2' }, { versaoBase: 1 })]),
        ]);
        const situacoes = [r1, r2].map((r) => r.body.data.resultados[0].situacao).sort();
        expect(situacoes).toEqual(['aceito', 'conflito']);
        expect((await DbConnect.prisma.pasto.findUnique({ where: { id: pasto.id } })).versao).toBe(2);
    });

    it('SYNC-POST-VER-14só edição pelo usuário sobe a versão: efeito colateral do servidor não conta', async () => {
        // Criar um rebanho no pasto o marca como Ocupado: consequência, não edição.
        const r = await api().post('/v1/rebanhos').set('Authorization', a.bearer).send({
            propriedadeId: propriedade.id, pastoAtualId: pasto.id, nomeRebanho: 'Lote novo', quantidadeCabecas: 3,
        });
        expect(r.status).toBe(201);

        const registro = await DbConnect.prisma.pasto.findUnique({ where: { id: pasto.id } });
        expect(registro.status).toBe('Ocupado');
        expect(registro.versao).toBe(1);

        // E a edição do aparelho, feita na versão que ele conhecia, segue valendo.
        const edicao = await sync(a, [editar(pasto.id, { nome: 'Editado' }, { versaoBase: 1 })]);
        expect(edicao.body.data.resultados[0].situacao).toBe('aceito');
    });
});
