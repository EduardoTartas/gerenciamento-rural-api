import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import DbConnect from '../../../src/config/dbConnect.js';
import { api } from '../../apoio/cliente.js';
import { criarUsuario } from '../../apoio/auth.js';
import { criarPropriedade, criarPasto, criarRebanho, criarTipoInsumo, criarInsumo } from '../../apoio/fabricas.js';
import { criarMovimentacaoInsumo, criarRegimeConsumoInsumo } from './apoio-local.js';

describe('DELETE /v1/insumos/:id', () => {
    let a;
    let propriedade;
    let tipoInsumo;

    beforeEach(async () => {
        a = await criarUsuario();
        propriedade = await criarPropriedade(a.id);
        tipoInsumo = await criarTipoInsumo();
    });

    const del = (usuario, id) =>
        api().delete(`/v1/insumos/${id}`).set('Authorization', usuario.bearer);

    it('INS-DELETE-ID-01 exclui (soft-delete)', async () => {
        const insumo = await criarInsumo(propriedade.id, { tipoInsumoId: tipoInsumo.id });
        const mov = await criarMovimentacaoInsumo(insumo.id, { tipo: 'Entrada', quantidade: 10 });

        const r = await del(a, insumo.id);
        expect(r.status).toBe(200);
        expect(r.body.message).toBe('Insumo excluído com sucesso.');

        const salvo = await DbConnect.prisma.insumo.findUnique({ where: { id: insumo.id } });
        expect(salvo.ativo).toBe(false);

        const movSalva = await DbConnect.prisma.movimentacaoInsumo.findUnique({ where: { id: mov.id } });
        expect(movSalva).not.toBeNull();
        expect(movSalva.ativo).toBe(true);
    });

    it('INS-DELETE-ID-02 id não é UUID', async () => {
        const r = await del(a, 'nao-e-uuid');
        expect(r.status).toBe(400);
        expect(r.body.tipo).toBe('validationError');
    });

    it('INS-DELETE-ID-03 sem token', async () => {
        const insumo = await criarInsumo(propriedade.id, { tipoInsumoId: tipoInsumo.id });
        const r = await api().delete(`/v1/insumos/${insumo.id}`);
        expect(r.status).toBe(401);
        expect(r.body.tipo).toBe('unauthorized');
    });

    it('INS-DELETE-ID-04 id inexistente', async () => {
        const r = await del(a, randomUUID());
        expect(r.status).toBe(404);
        expect(r.body.message).toBe('Recurso não encontrado em Insumo.');
    });

    it('INS-DELETE-ID-05 multi-tenancy: B exclui id de um insumo de A', async () => {
        const insumo = await criarInsumo(propriedade.id, { tipoInsumoId: tipoInsumo.id });
        const b = await criarUsuario();

        const r = await del(b, insumo.id);
        expect(r.status).toBe(404);
        expect(r.body.message).toBe('Recurso não encontrado em Insumo.');
        const salvo = await DbConnect.prisma.insumo.findUnique({ where: { id: insumo.id } });
        expect(salvo.ativo).toBe(true);
    });

    describe('regimes de consumo do insumo', () => {
        let rebanho;

        beforeEach(async () => {
            const pasto = await criarPasto(propriedade.id);
            rebanho = await criarRebanho(propriedade.id, pasto.id);
        });

        const regime = (id) => DbConnect.prisma.regimeConsumoInsumo.findUnique({ where: { id } });

        it('INS-DELETE-ID-06 desativa e encerra os regimes ativos do insumo', async () => {
            const insumo = await criarInsumo(propriedade.id, { tipoInsumoId: tipoInsumo.id });
            const aberto = await criarRegimeConsumoInsumo(rebanho.id, insumo.id, {
                dataInicio: new Date('2026-01-01T00:00:00Z'),
            });

            const antes = Date.now();
            const r = await del(a, insumo.id);
            expect(r.status).toBe(200);

            const salvo = await regime(aberto.id);
            expect(salvo.ativo).toBe(false);
            expect(salvo.dataFim).not.toBeNull();
            expect(salvo.dataFim.getTime()).toBeGreaterThanOrEqual(antes - 1000);
        });

        it('INS-DELETE-ID-07 regime que ainda não começou encerra na própria dataInicio', async () => {
            const insumo = await criarInsumo(propriedade.id, { tipoInsumoId: tipoInsumo.id });
            const futuro = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
            const r0 = await criarRegimeConsumoInsumo(rebanho.id, insumo.id, { dataInicio: futuro });

            const r = await del(a, insumo.id);
            expect(r.status).toBe(200);

            const salvo = await regime(r0.id);
            expect(salvo.ativo).toBe(false);
            expect(salvo.dataFim.getTime()).toBe(futuro.getTime());
        });

        it('INS-DELETE-ID-08 regime já encerrado não é alterado', async () => {
            const insumo = await criarInsumo(propriedade.id, { tipoInsumoId: tipoInsumo.id });
            const dataFim = new Date('2026-02-01T00:00:00Z');
            const encerrado = await criarRegimeConsumoInsumo(rebanho.id, insumo.id, {
                dataInicio: new Date('2026-01-01T00:00:00Z'),
                dataFim,
                ativo: false,
            });

            await del(a, insumo.id);

            const salvo = await regime(encerrado.id);
            expect(salvo.dataFim.getTime()).toBe(dataFim.getTime());
            expect(salvo.updatedAt.getTime()).toBe(encerrado.updatedAt.getTime());
        });

        it('INS-DELETE-ID-09 regime de outro insumo continua ativo', async () => {
            const insumo = await criarInsumo(propriedade.id, { tipoInsumoId: tipoInsumo.id });
            const outro = await criarInsumo(propriedade.id, { tipoInsumoId: tipoInsumo.id });
            const doOutro = await criarRegimeConsumoInsumo(rebanho.id, outro.id);

            await del(a, insumo.id);

            const salvo = await regime(doOutro.id);
            expect(salvo.ativo).toBe(true);
            expect(salvo.dataFim).toBeNull();
        });

        it('INS-DELETE-ID-10 mantém o histórico: movimentações do insumo seguem ativas', async () => {
            const insumo = await criarInsumo(propriedade.id, { tipoInsumoId: tipoInsumo.id });
            const mov = await criarMovimentacaoInsumo(insumo.id, { tipo: 'Saida', quantidade: 3, origem: 'ConsumoRebanho' });
            await criarRegimeConsumoInsumo(rebanho.id, insumo.id);

            await del(a, insumo.id);

            const movSalva = await DbConnect.prisma.movimentacaoInsumo.findUnique({ where: { id: mov.id } });
            expect(movSalva.ativo).toBe(true);
        });

        it('INS-DELETE-ID-11 sem regimes o delete segue funcionando', async () => {
            const insumo = await criarInsumo(propriedade.id, { tipoInsumoId: tipoInsumo.id });

            const r = await del(a, insumo.id);

            expect(r.status).toBe(200);
        });
    });
});
