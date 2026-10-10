import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import DbConnect from '../../../src/config/dbConnect.js';
import { api } from '../../apoio/cliente.js';
import { criarUsuario } from '../../apoio/auth.js';
import { criarPropriedade } from '../../apoio/fabricas.js';
import { criarNotificacao, reiniciarNpaasFalso } from './apoio-local.js';

const npaasFalso = vi.hoisted(() => ({
    ativo: true, enviar: vi.fn(), registrarDispositivo: vi.fn(), desativarToken: vi.fn(),
}));
vi.mock('../../../src/utils/npaas.js', async () => {
    const { moduloNpaasFalso } = await import('./apoio-local.js');
    return moduloNpaasFalso(npaasFalso);
});

describe('Caixa de notificações — /v1/notificacoes', () => {
    let a, b;

    beforeEach(async () => {
        reiniciarNpaasFalso(npaasFalso);
        a = await criarUsuario();
        b = await criarUsuario();
    });

    const listar = (usuario, query = {}) =>
        api().get('/v1/notificacoes').query(query).set('Authorization', usuario.bearer);

    describe('GET /v1/notificacoes', () => {
        it('NOTIF-GET-01 lista só as do usuário, da mais nova para a mais antiga, com o contrato do app', async () => {
            const antiga = await criarNotificacao(a.id, { createdAt: new Date('2026-01-01T10:00:00Z') });
            const nova = await criarNotificacao(a.id, { createdAt: new Date('2026-01-02T10:00:00Z') });
            await criarNotificacao(b.id);

            const r = await listar(a);

            expect(r.status).toBe(200);
            expect(r.body.data.totalDocs).toBe(2);
            expect(r.body.data.docs.map((n) => n.id)).toEqual([nova.id, antiga.id]);
            const item = r.body.data.docs[0];
            for (const campo of ['id', 'tipo', 'titulo', 'mensagem', 'lida', 'entidade', 'entidadeId',
                'propriedadeId', 'rota', 'createdAt', 'updatedAt']) {
                expect(item).toHaveProperty(campo);
            }
            // Campos internos do push e da deduplicação não vazam.
            expect(item).not.toHaveProperty('chaveAtiva');
            expect(item).not.toHaveProperty('pushStatus');
            expect(item).not.toHaveProperty('usuarioId');
        });

        it('NOTIF-GET-02 filtra por lida e devolve naoLidas independente do filtro', async () => {
            await criarNotificacao(a.id, { lida: true, lidaEm: new Date() });
            await criarNotificacao(a.id);
            await criarNotificacao(a.id);

            const r = await listar(a, { lida: 'true' });

            expect(r.status).toBe(200);
            expect(r.body.data.totalDocs).toBe(1);
            expect(r.body.data.docs[0].lida).toBe(true);
            expect(r.body.data.naoLidas).toBe(2);
        });

        it('NOTIF-GET-03 atualizadoDesde devolve só o que mudou depois do instante', async () => {
            await criarNotificacao(a.id);
            const corte = new Date();
            await new Promise((resolve) => setTimeout(resolve, 20));
            const depois = await criarNotificacao(a.id);

            const r = await listar(a, { atualizadoDesde: corte.toISOString() });

            expect(r.status).toBe(200);
            expect(r.body.data.docs.map((n) => n.id)).toEqual([depois.id]);
        });

        it('NOTIF-GET-04 filtra por propriedadeId e pagina', async () => {
            const fazenda = await criarPropriedade(a.id);
            await criarNotificacao(a.id, { propriedadeId: fazenda.id });
            await criarNotificacao(a.id, { propriedadeId: fazenda.id });
            await criarNotificacao(a.id);

            const r = await listar(a, { propriedadeId: fazenda.id, limit: '1', page: '2' });

            expect(r.status).toBe(200);
            expect(r.body.data.totalDocs).toBe(2);
            expect(r.body.data.totalPages).toBe(2);
            expect(r.body.data.docs).toHaveLength(1);
        });

        it('NOTIF-GET-05 query inválida ou desconhecida → 400', async () => {
            expect((await listar(a, { lida: 'talvez' })).status).toBe(400);
            expect((await listar(a, { atualizadoDesde: 'ontem' })).status).toBe(400);
            expect((await listar(a, { usuarioId: b.id })).status).toBe(400);
        });

        it('NOTIF-GET-06 sem autenticação → 401', async () => {
            expect((await api().get('/v1/notificacoes')).status).toBe(401);
        });
    });

    describe('GET /v1/notificacoes/:id', () => {
        it('NOTIF-GETID-01 detalha a própria; de outro usuário ou inexistente → 404', async () => {
            const minha = await criarNotificacao(a.id);
            const alheia = await criarNotificacao(b.id);

            const ok = await api().get(`/v1/notificacoes/${minha.id}`).set('Authorization', a.bearer);
            expect(ok.status).toBe(200);
            expect(ok.body.data.id).toBe(minha.id);

            expect((await api().get(`/v1/notificacoes/${alheia.id}`).set('Authorization', a.bearer)).status).toBe(404);
            expect((await api().get(`/v1/notificacoes/${randomUUID()}`).set('Authorization', a.bearer)).status).toBe(404);
            expect((await api().get('/v1/notificacoes/nao-e-uuid').set('Authorization', a.bearer)).status).toBe(400);
        });
    });

    describe('PATCH /v1/notificacoes/:id', () => {
        const patch = (usuario, id, corpo) =>
            api().patch(`/v1/notificacoes/${id}`).set('Authorization', usuario.bearer).send(corpo);

        it('NOTIF-PATCH-01 marca como lida, grava lidaEm e avança updatedAt', async () => {
            const n = await criarNotificacao(a.id);

            const r = await patch(a, n.id, { lida: true });

            expect(r.status).toBe(200);
            expect(r.body.data.lida).toBe(true);
            expect(r.body.data.lidaEm).not.toBeNull();
            expect(new Date(r.body.data.updatedAt).getTime()).toBeGreaterThan(n.updatedAt.getTime());
        });

        it('NOTIF-PATCH-02 lida: false desfaz a leitura', async () => {
            const n = await criarNotificacao(a.id, { lida: true, lidaEm: new Date() });

            const r = await patch(a, n.id, { lida: false });

            expect(r.status).toBe(200);
            expect(r.body.data.lida).toBe(false);
            expect(r.body.data.lidaEm).toBeNull();
        });

        it('NOTIF-PATCH-03 de outro usuário → 404 e nada muda', async () => {
            const alheia = await criarNotificacao(b.id);

            expect((await patch(a, alheia.id, { lida: true })).status).toBe(404);
            const salvo = await DbConnect.prisma.notificacao.findUnique({ where: { id: alheia.id } });
            expect(salvo.lida).toBe(false);
        });

        it('NOTIF-PATCH-04 corpo vazio, campo extra ou lida não booleana → 400', async () => {
            const n = await criarNotificacao(a.id);

            expect((await patch(a, n.id, {})).status).toBe(400);
            expect((await patch(a, n.id, { lida: true, titulo: 'outro' })).status).toBe(400);
            expect((await patch(a, n.id, { lida: 'sim' })).status).toBe(400);
        });
    });

    describe('PATCH /v1/notificacoes/lidas', () => {
        const marcarTodas = (usuario, corpo) =>
            api().patch('/v1/notificacoes/lidas').set('Authorization', usuario.bearer).send(corpo);

        it('NOTIF-LIDAS-01 marca todas as não lidas do usuário, sem tocar nas de outro', async () => {
            await criarNotificacao(a.id);
            await criarNotificacao(a.id);
            await criarNotificacao(a.id, { lida: true, lidaEm: new Date() });
            const alheia = await criarNotificacao(b.id);

            const r = await marcarTodas(a);

            expect(r.status).toBe(200);
            expect(r.body.data.marcadas).toBe(2);
            expect(await DbConnect.prisma.notificacao.count({ where: { usuarioId: a.id, lida: false } })).toBe(0);
            const salvo = await DbConnect.prisma.notificacao.findUnique({ where: { id: alheia.id } });
            expect(salvo.lida).toBe(false);
        });

        it('NOTIF-LIDAS-02 com propriedadeId marca só as daquela fazenda', async () => {
            const fazenda = await criarPropriedade(a.id);
            await criarNotificacao(a.id, { propriedadeId: fazenda.id });
            const outra = await criarNotificacao(a.id);

            const r = await marcarTodas(a, { propriedadeId: fazenda.id });

            expect(r.status).toBe(200);
            expect(r.body.data.marcadas).toBe(1);
            const salvo = await DbConnect.prisma.notificacao.findUnique({ where: { id: outra.id } });
            expect(salvo.lida).toBe(false);
        });

        it('NOTIF-LIDAS-03 campo extra → 400', async () => {
            expect((await marcarTodas(a, { tudo: true })).status).toBe(400);
        });
    });

    describe('POST /v1/sync — notificacoes:UPDATE', () => {
        const sync = (usuario, mutacoes) =>
            api().post('/v1/sync').set('Authorization', usuario.bearer).send({ mutacoes });

        it('NOTIF-SYNC-01 marca como lida pelo lote', async () => {
            const n = await criarNotificacao(a.id);

            const r = await sync(a, [{
                id: randomUUID(), entidade: 'notificacoes', acao: 'UPDATE', entidadeId: n.id, dados: { lida: true },
            }]);

            expect(r.status).toBe(200);
            expect(r.body.data.resultados[0].situacao).toBe('aceito');
            const salvo = await DbConnect.prisma.notificacao.findUnique({ where: { id: n.id } });
            expect(salvo.lida).toBe(true);
            expect(salvo.lidaEm).not.toBeNull();
        });

        it('NOTIF-SYNC-02 campo além de lida é recusado; notificação de outro usuário é recusada', async () => {
            const minha = await criarNotificacao(a.id);
            const alheia = await criarNotificacao(b.id);

            const r = await sync(a, [
                { id: randomUUID(), entidade: 'notificacoes', acao: 'UPDATE', entidadeId: minha.id, dados: { lida: true, tipo: 'X' } },
                { id: randomUUID(), entidade: 'notificacoes', acao: 'UPDATE', entidadeId: alheia.id, dados: { lida: true } },
            ]);

            expect(r.status).toBe(200);
            const [extra, deOutro] = r.body.data.resultados;
            expect(extra.situacao).toBe('recusado');
            expect(deOutro.situacao).toBe('recusado');
            const salvo = await DbConnect.prisma.notificacao.findUnique({ where: { id: alheia.id } });
            expect(salvo.lida).toBe(false);
        });

        it('NOTIF-SYNC-03 CREATE e DELETE de notificação não existem no lote', async () => {
            const n = await criarNotificacao(a.id);

            const r = await sync(a, [
                { id: randomUUID(), entidade: 'notificacoes', acao: 'CREATE', entidadeId: randomUUID(), dados: { lida: false } },
                { id: randomUUID(), entidade: 'notificacoes', acao: 'DELETE', entidadeId: n.id },
            ]);

            expect(r.status).toBe(200);
            expect(r.body.data.resultados.map((x) => x.situacao)).toEqual(['recusado', 'recusado']);
            expect(await DbConnect.prisma.notificacao.count({ where: { usuarioId: a.id } })).toBe(1);
        });
    });
});
