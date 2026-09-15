import { describe, expect, it } from 'vitest';
import { api } from '../../apoio/cliente.js';
import { criarUsuario } from '../../apoio/auth.js';

describe('transversal', () => {
    it('APP-GET-01 health responde healthy com banco conectado', async () => {
        const r = await api().get('/health');
        expect(r.status).toBe(200);
        expect(r.body).toMatchObject({ status: 'healthy', database: 'connected' });
        expect(r.body.timestamp).toBeDefined();
        expect(r.body.uptime).toBeDefined();
    });

    it('APP-GET-02 rota inexistente responde 404 no envelope', async () => {
        const r = await api().get('/v1/nao-existe');
        expect(r.status).toBe(404);
        expect(r.body).toMatchObject({ data: null, tipo: 'resourceNotFound', recuperavel: false });
        expect(r.body.errors[0].message).toBe('Rota não encontrada.');
    });

    it('APP-GET-03 método não suportado numa rota existente responde igual a rota inexistente', async () => {
        const r = await api().put('/v1/propriedades');
        expect(r.status).toBe(404);
        expect(r.body).toMatchObject({ data: null, tipo: 'resourceNotFound', recuperavel: false });
        expect(r.body.errors[0].message).toBe('Rota não encontrada.');
    });

    it('APP-POST-01 JSON inválido responde 400 com mensagem de sintaxe', async () => {
        const a = await criarUsuario();
        const r = await api()
            .post('/v1/propriedades')
            .set('Authorization', a.bearer)
            .set('Content-Type', 'application/json')
            .send('{nome:}');
        expect(r.status).toBe(400);
        expect(r.body.tipo).toBe('validationError');
        expect(r.body.message).toBe('Formato JSON inválido.');
        expect(r.body.errors[0].message).toBe('JSON inválido. Verifique a sintaxe do corpo da requisição.');
    });

    it('APP-GET-04 /pastagens/manejos não é capturada por /pastagens/:id', async () => {
        const a = await criarUsuario();
        const r = await api().get('/v1/pastagens/manejos').set('Authorization', a.bearer);
        expect(r.status).toBe(200);
        expect(r.body.data.docs).toBeDefined();
    });

    it('APP-GET-05 /rebanhos/manejos não é capturada por /rebanhos/:id', async () => {
        const a = await criarUsuario();
        const r = await api().get('/v1/rebanhos/manejos').set('Authorization', a.bearer);
        expect(r.status).toBe(200);
        expect(r.body.data.docs).toBeDefined();
    });

    it('APP-GET-06 /rebanhos/movimentacoes não é capturada por /rebanhos/:id', async () => {
        const a = await criarUsuario();
        const r = await api().get('/v1/rebanhos/movimentacoes').set('Authorization', a.bearer);
        expect(r.status).toBe(200);
        expect(r.body.data.docs).toBeDefined();
    });

    it('APP-GET-07 /rebanhos/regimes-consumo não é capturada por /rebanhos/:id', async () => {
        const a = await criarUsuario();
        const r = await api().get('/v1/rebanhos/regimes-consumo').set('Authorization', a.bearer);
        expect(r.status).toBe(200);
        expect(r.body.data.docs).toBeDefined();
    });

    // MovimentacaoInsumoService exige `insumoId` ou `atualizadoDesde` na listagem
    // (leitura por diferença é a exceção) — sem isso o /insumos/:id genérico
    // também daria 400, então `atualizadoDesde` prova que a rota fixa foi
    // capturada (schema aceito) sem depender de um insumo existir.
    it('APP-GET-08 /insumos/movimentacoes não é capturada por /insumos/:id', async () => {
        const a = await criarUsuario();
        const r = await api()
            .get('/v1/insumos/movimentacoes?atualizadoDesde=1970-01-01T00:00:00.000Z')
            .set('Authorization', a.bearer);
        expect(r.status).toBe(200);
        expect(r.body.data.docs).toBeDefined();
    });

    it('APP-GET-09 rota protegida sem Authorization responde 401', async () => {
        const r = await api().get('/v1/propriedades');
        expect(r.status).toBe(401);
        expect(r.body).toMatchObject({ tipo: 'unauthorized', recuperavel: true });
        expect(r.body.message).toBe('Sessão inválida ou expirada. Faça login novamente.');
    });

    it('APP-GET-10 rota protegida com token inválido responde 401', async () => {
        const r = await api()
            .get('/v1/propriedades')
            .set('Authorization', 'Bearer token-invalido');
        expect(r.status).toBe(401);
        expect(r.body).toMatchObject({ tipo: 'unauthorized', recuperavel: true });
        expect(r.body.message).toBe('Sessão inválida ou expirada. Faça login novamente.');
    });

    it('APP-GET-11 rota protegida com sessão expirada/revogada responde 401', async () => {
        const a = await criarUsuario();
        const { default: DbConnect } = await import('../../../src/config/dbConnect.js');
        await DbConnect.prisma.session.deleteMany({ where: { userId: a.id } });

        const r = await api().get('/v1/propriedades').set('Authorization', a.bearer);
        expect(r.status).toBe(401);
        expect(r.body).toMatchObject({ tipo: 'unauthorized', recuperavel: true });
        expect(r.body.message).toBe('Sessão inválida ou expirada. Faça login novamente.');
    });
});
