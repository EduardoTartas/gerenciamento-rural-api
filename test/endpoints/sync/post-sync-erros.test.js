import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import DbConnect from '../../../src/config/dbConnect.js';
import { api } from '../../apoio/cliente.js';
import { criarUsuario } from '../../apoio/auth.js';
import { criarPropriedade, criarPasto, criarRebanho, criarTipoInsumo } from '../../apoio/fabricas.js';

describe('POST /v1/sync — contrato de erro tipado e transação por item', () => {
    let a, propriedade;

    beforeEach(async () => {
        a = await criarUsuario();
        propriedade = await criarPropriedade(a.id);
    });

    const sync = (usuario, mutacoes) =>
        api().post('/v1/sync').set('Authorization', usuario.bearer).send({ mutacoes });

    it('SYNC-POST-63 recusa por regra de negócio (resourceNotFound) vem com recuperavel: false', async () => {
        const m = {
            id: randomUUID(), entidade: 'pastos', acao: 'UPDATE', entidadeId: randomUUID(),
            dados: { nome: 'Não Existe' },
        };
        const r = await sync(a, [m]);
        const res = r.body.data.resultados[0];
        expect(res.situacao).toBe('recusado');
        expect(res.erro.tipo).toBe('resourceNotFound');
        expect(res.erro.recuperavel).toBe(false);
        expect(res.erro.mensagem).toBe('Recurso não encontrado em Pastagem.');
    });

    it('SYNC-POST-64 recusa por conflito (nome duplicado) vem com tipo conflict, recuperavel: false', async () => {
        await criarPasto(propriedade.id, { nome: 'Repetido' });
        const m = {
            id: randomUUID(), entidade: 'pastos', acao: 'CREATE', entidadeId: randomUUID(),
            dados: { propriedadeId: propriedade.id, nome: 'Repetido' },
        };
        const r = await sync(a, [m]);
        const res = r.body.data.resultados[0];
        expect(res.situacao).toBe('recusado');
        expect(res.erro.tipo).toBe('conflict');
        expect(res.erro.recuperavel).toBe(false);
    });

    it('SYNC-POST-65 erro inesperado (sem errorType) vira serverError recuperável, sem vazar detalhe técnico', async () => {
        const pasto = await criarPasto(propriedade.id);
        const rebanho = await criarRebanho(propriedade.id, pasto.id);

        // racaId não existe em `raca`: RebanhoUpdateSchema aceita o campo (é um
        // FK opcional, não validado pelo service), então o Prisma lança uma
        // violação de chave estrangeira crua (sem `errorType`) — exatamente o
        // caso "erro sem CustomError" que o lote precisa reclassificar.
        const m = {
            id: randomUUID(), entidade: 'rebanhos', acao: 'UPDATE', entidadeId: rebanho.id,
            dados: { racaId: randomUUID() },
        };
        const r = await sync(a, [m]);
        const res = r.body.data.resultados[0];
        expect(res.situacao).toBe('recusado');
        expect(res.erro.tipo).toBe('serverError');
        expect(res.erro.recuperavel).toBe(true);
        expect(res.erro.mensagem).toBe('Erro ao aplicar a mutação. Tente novamente mais tarde.');
        expect(res.erro.mensagem).not.toContain('raca');
        expect(res.erro.mensagem).not.toContain('constraint');
        expect(res.erro.mensagem).not.toContain('rebanhos');
    });

    it('SYNC-POST-66 resposta HTTP é sempre 200 mesmo com todas as mutações recusadas', async () => {
        await criarPasto(propriedade.id, { nome: 'Já Existe' });
        const mutacoes = Array.from({ length: 2 }, () => ({
            id: randomUUID(), entidade: 'pastos', acao: 'CREATE', entidadeId: randomUUID(),
            dados: { propriedadeId: propriedade.id, nome: 'Já Existe' },
        }));
        const r = await sync(a, mutacoes);
        expect(r.status).toBe(200);
        expect(r.body.data.resultados.every((res) => res.situacao === 'recusado')).toBe(true);
        expect(r.body.message).toBe('0 de 2 mutações aplicadas.');
    });

    it('SYNC-POST-67 mensagem do lote conta só os aceitos', async () => {
        await criarPasto(propriedade.id, { nome: 'Duplicado Misto' });
        const aceita1 = {
            id: randomUUID(), entidade: 'pastos', acao: 'CREATE', entidadeId: randomUUID(),
            dados: { propriedadeId: propriedade.id, nome: 'Nova 1' },
        };
        const aceita2 = {
            id: randomUUID(), entidade: 'pastos', acao: 'CREATE', entidadeId: randomUUID(),
            dados: { propriedadeId: propriedade.id, nome: 'Nova 2' },
        };
        const recusada = {
            id: randomUUID(), entidade: 'pastos', acao: 'CREATE', entidadeId: randomUUID(),
            dados: { propriedadeId: propriedade.id, nome: 'Duplicado Misto' },
        };
        const bloqueada = {
            id: randomUUID(), entidade: 'rebanhos', acao: 'CREATE', entidadeId: randomUUID(),
            dependeDe: recusada.id,
            dados: { propriedadeId: propriedade.id, pastoAtualId: recusada.entidadeId, nomeRebanho: 'Bloqueado' },
        };

        const r = await sync(a, [aceita1, aceita2, recusada, bloqueada]);
        expect(r.status).toBe(200);
        expect(r.body.message).toBe('2 de 4 mutações aplicadas.');
    });

    it('SYNC-POST-68 mutação e registro de idempotência entram juntos (ou nenhum dos dois)', async () => {
        const m = {
            id: randomUUID(), entidade: 'pastos', acao: 'CREATE', entidadeId: randomUUID(),
            dados: { propriedadeId: propriedade.id, nome: 'Piquete Transação' },
        };
        const r = await sync(a, [m]);
        expect(r.body.data.resultados[0].situacao).toBe('aceito');

        const pasto = await DbConnect.prisma.pasto.findUnique({ where: { id: m.entidadeId } });
        expect(pasto).not.toBeNull();
        const registro = await DbConnect.prisma.mutacaoAplicada.findUnique({ where: { id_usuarioId: { id: m.id, usuarioId: a.id } } });
        expect(registro).not.toBeNull();
        expect(registro.entidadeId).toBe(m.entidadeId);
    });

    it('SYNC-POST-69 falha dentro da transação não deixa a entidade "meio-criada"', async () => {
        await criarPasto(propriedade.id, { nome: 'Conflito Transação' });
        const m = {
            id: randomUUID(), entidade: 'pastos', acao: 'CREATE', entidadeId: randomUUID(),
            dados: { propriedadeId: propriedade.id, nome: 'Conflito Transação' },
        };
        const r = await sync(a, [m]);
        expect(r.body.data.resultados[0].situacao).toBe('recusado');

        const orfao = await DbConnect.prisma.pasto.findUnique({ where: { id: m.entidadeId } });
        expect(orfao).toBeNull();
        const registro = await DbConnect.prisma.mutacaoAplicada.findUnique({ where: { id_usuarioId: { id: m.id, usuarioId: a.id } } });
        expect(registro).toBeNull();
    });

    it('SYNC-POST-70 mutação de um item não afeta a transação de outro item do mesmo lote', async () => {
        await criarPasto(propriedade.id, { nome: 'Falha Isolada' });
        const tipoInsumo = await criarTipoInsumo();

        const falha = {
            id: randomUUID(), entidade: 'pastos', acao: 'CREATE', entidadeId: randomUUID(),
            dados: { propriedadeId: propriedade.id, nome: 'Falha Isolada' },
        };
        const sucesso = {
            id: randomUUID(), entidade: 'insumos', acao: 'CREATE', entidadeId: randomUUID(),
            dados: {
                propriedadeId: propriedade.id, tipoInsumoId: tipoInsumo.id,
                nome: 'Insumo Independente', destino: 'Ambos', unidadeMedida: 'kg',
            },
        };

        const r = await sync(a, [falha, sucesso]);
        const resFalha = r.body.data.resultados.find((x) => x.id === falha.id);
        const resSucesso = r.body.data.resultados.find((x) => x.id === sucesso.id);
        expect(resFalha.situacao).toBe('recusado');
        expect(resSucesso.situacao).toBe('aceito');

        const insumoSalvo = await DbConnect.prisma.insumo.findUnique({ where: { id: sucesso.entidadeId } });
        expect(insumoSalvo).not.toBeNull();
        expect(await DbConnect.prisma.mutacaoAplicada.findUnique({ where: { id_usuarioId: { id: sucesso.id, usuarioId: a.id } } })).not.toBeNull();
    });
});
