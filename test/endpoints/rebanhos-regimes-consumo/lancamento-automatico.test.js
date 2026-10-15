import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import DbConnect from '../../../src/config/dbConnect.js';
import { api } from '../../apoio/cliente.js';
import { criarUsuario } from '../../apoio/auth.js';
import { criarPropriedade, criarPasto, criarRebanho, criarInsumo } from '../../apoio/fabricas.js';
import { criarRegimeConsumo } from './apoio-local.js';
import { criarMovimentacaoInsumo } from '../sync/apoio-local.js';
import { reiniciarNpaasFalso } from '../notificacoes/apoio-local.js';

// O disparo manual da verificação também envia push: nenhum teste fala com o
// NPaaS de verdade.
const npaasFalso = vi.hoisted(() => ({
    ativo: false, enviar: vi.fn(), registrarDispositivo: vi.fn(), desativarToken: vi.fn(),
}));
vi.mock('../../../src/utils/npaas.js', async () => {
    const { moduloNpaasFalso } = await import('../notificacoes/apoio-local.js');
    return moduloNpaasFalso(npaasFalso);
});

const { prisma } = DbConnect;
const DIA = 24 * 60 * 60 * 1000;
const diasAtras = (n) => new Date(Date.now() - n * DIA);

/**
 * Lançamento automático do consumo diário (issue #72): o servidor grava uma
 * saída `ConsumoRebanho` a cada 24 h para o regime com `lancamentoAutomatico`,
 * a partir do último consumo lançado daquele rebanho, sem passar do estoque.
 */
describe('Lançamento automático do consumo diário', () => {
    let a, propriedade, pasto, rebanho, insumo;

    beforeEach(async () => {
        reiniciarNpaasFalso(npaasFalso);
        npaasFalso.ativo = false;
        a = await criarUsuario();
        propriedade = await criarPropriedade(a.id);
        pasto = await criarPasto(propriedade.id);
        rebanho = await criarRebanho(propriedade.id, pasto.id, { nomeRebanho: 'Garrotes' });
        insumo = await criarInsumo(propriedade.id, { destino: 'Ambos' });
        await criarMovimentacaoInsumo(insumo.id, { quantidade: 100, data: diasAtras(30) });
    });

    const verificar = (usuario = a) =>
        api().post('/v1/notificacoes/verificar').set('Authorization', usuario.bearer);
    const lancamentos = (regimeConsumoId) =>
        prisma.movimentacaoInsumo.findMany({ where: { regimeConsumoId }, orderBy: { data: 'asc' } });
    const saldoDoInsumo = async () =>
        (await api().get(`/v1/insumos/${insumo.id}`).set('Authorization', a.bearer)).body.data.saldo;

    it('CONSAUTO-01 regime aceita lancamentoAutomatico no cadastro e na edição; sem o campo é manual', async () => {
        const post = (corpo) =>
            api().post('/v1/rebanhos/regimes-consumo').set('Authorization', a.bearer).send(corpo);
        const manual = await post({ rebanhoId: rebanho.id, insumoId: insumo.id, quantidadeDia: 3, dataInicio: diasAtras(1).toISOString() });
        expect(manual.status).toBe(201);
        expect(manual.body.data.lancamentoAutomatico).toBe(false);

        const ligado = await api().patch(`/v1/rebanhos/regimes-consumo/${manual.body.data.id}`)
            .set('Authorization', a.bearer).send({ lancamentoAutomatico: true });
        expect(ligado.status).toBe(200);
        expect(ligado.body.data.lancamentoAutomatico).toBe(true);

        const invalido = await post({
            rebanhoId: rebanho.id, insumoId: insumo.id, quantidadeDia: 3,
            dataInicio: diasAtras(1).toISOString(), lancamentoAutomatico: 'sim',
        });
        expect(invalido.status).toBe(400);
    });

    it('CONSAUTO-02 lança uma saída de consumo do rebanho a cada 24 h desde o início do regime', async () => {
        const regime = await criarRegimeConsumo(rebanho.id, insumo.id, {
            quantidadeDia: 5, dataInicio: diasAtras(3.5), lancamentoAutomatico: true,
        });

        const r = await verificar();

        expect(r.status).toBe(200);
        expect(r.body.data.lancamentos).toBe(3);
        const lista = await lancamentos(regime.id);
        expect(lista).toHaveLength(3);
        for (const [k, m] of lista.entries()) {
            expect(m).toMatchObject({
                tipo: 'Saida', origem: 'ConsumoRebanho', rebanhoId: rebanho.id, insumoId: insumo.id, ativo: true,
            });
            expect(Number(m.quantidade)).toBe(5);
            expect(m.data.getTime()).toBe(regime.dataInicio.getTime() + (k + 1) * DIA);
        }
        const saldo = await saldoDoInsumo();
        expect(saldo.saldoReal).toBe(85);
        expect(saldo.consumoProjetado).toBe(0);
    });

    it('CONSAUTO-03 rodar de novo não duplica nenhum dia', async () => {
        const regime = await criarRegimeConsumo(rebanho.id, insumo.id, {
            quantidadeDia: 5, dataInicio: diasAtras(2.5), lancamentoAutomatico: true,
        });

        await verificar();
        const segunda = await verificar();

        expect(segunda.body.data.lancamentos).toBe(0);
        expect(await lancamentos(regime.id)).toHaveLength(2);
    });

    it('CONSAUTO-04 continua do último consumo lançado daquele rebanho, sem lançar de novo o período', async () => {
        await criarMovimentacaoInsumo(insumo.id, {
            tipo: 'Saida', origem: 'ConsumoRebanho', rebanhoId: rebanho.id, quantidade: 20, data: diasAtras(1.5),
        });
        const regime = await criarRegimeConsumo(rebanho.id, insumo.id, {
            quantidadeDia: 5, dataInicio: diasAtras(10), lancamentoAutomatico: true,
        });

        await verificar();

        expect(await lancamentos(regime.id)).toHaveLength(1);
    });

    it('CONSAUTO-05 nunca lança mais do que o estoque: lança o que resta e para', async () => {
        const regime = await criarRegimeConsumo(rebanho.id, insumo.id, {
            quantidadeDia: 40, dataInicio: diasAtras(5.5), lancamentoAutomatico: true,
        });

        await verificar();

        const lista = await lancamentos(regime.id);
        expect(lista.map((m) => Number(m.quantidade))).toEqual([40, 40, 20]);
        expect((await saldoDoInsumo()).saldoReal).toBe(0);
    });

    it('CONSAUTO-06 regime manual e regime de outro produtor não são lançados pela verificação de A', async () => {
        const manual = await criarRegimeConsumo(rebanho.id, insumo.id, { quantidadeDia: 5, dataInicio: diasAtras(3.5) });
        const b = await criarUsuario();
        const fazendaB = await criarPropriedade(b.id);
        const rebanhoB = await criarRebanho(fazendaB.id, (await criarPasto(fazendaB.id)).id);
        const insumoB = await criarInsumo(fazendaB.id, { destino: 'Ambos' });
        await criarMovimentacaoInsumo(insumoB.id, { quantidade: 100, data: diasAtras(30) });
        const deB = await criarRegimeConsumo(rebanhoB.id, insumoB.id, {
            quantidadeDia: 5, dataInicio: diasAtras(3.5), lancamentoAutomatico: true,
        });

        await verificar(a);

        expect(await lancamentos(manual.id)).toHaveLength(0);
        expect(await lancamentos(deB.id)).toHaveLength(0);
    });

    it('CONSAUTO-07 respeita o fim do regime', async () => {
        const regime = await criarRegimeConsumo(rebanho.id, insumo.id, {
            quantidadeDia: 5, dataInicio: diasAtras(6.5), dataFim: diasAtras(4), ativo: false, lancamentoAutomatico: true,
        });

        await verificar();

        expect(await lancamentos(regime.id)).toHaveLength(2);
    });

    it('CONSAUTO-08 consumo lançado de um lote não apaga a estimativa do consumo manual de outro lote', async () => {
        const outro = await criarRebanho(propriedade.id, pasto.id, { nomeRebanho: 'Novilhas' });
        await criarRegimeConsumo(rebanho.id, insumo.id, { quantidadeDia: 5, dataInicio: diasAtras(4.5), lancamentoAutomatico: true });
        await criarRegimeConsumo(outro.id, insumo.id, { quantidadeDia: 2, dataInicio: diasAtras(4.5) });

        await verificar();

        const saldo = await saldoDoInsumo();
        expect(saldo.saldoReal).toBe(80);         // 100 − 4 dias × 5 do lote automático
        expect(saldo.consumoProjetado).toBe(8);   // 4 dias × 2 do lote manual, ainda não lançados
        const lista = await api().get(`/v1/insumos?propriedadeId=${propriedade.id}`).set('Authorization', a.bearer);
        expect(lista.body.data.docs[0].saldo.consumoProjetado).toBe(8);
    });

    it('CONSAUTO-09 /sync cria regime automático e a movimentação lançada traz o regimeConsumoId', async () => {
        const entidadeId = randomUUID();
        const r = await api().post('/v1/sync').set('Authorization', a.bearer).send({
            mutacoes: [{
                id: randomUUID(), entidade: 'regimes_consumo_insumo', acao: 'CREATE', entidadeId,
                dados: { rebanhoId: rebanho.id, insumoId: insumo.id, quantidadeDia: 5, dataInicio: diasAtras(1.5).toISOString(), lancamentoAutomatico: true },
            }],
        });
        expect(r.body.data.resultados[0].situacao).toBe('aceito');

        await verificar();

        const movs = await api().get(`/v1/insumos/movimentacoes?insumoId=${insumo.id}&origem=ConsumoRebanho`)
            .set('Authorization', a.bearer);
        expect(movs.body.data.docs).toHaveLength(1);
        expect(movs.body.data.docs[0].regimeConsumoId).toBe(entidadeId);
    });

    it('CONSAUTO-10 dia sem estoque não é lançado, e a compra de hoje não cobre os dias que passaram', async () => {
        const regime = await criarRegimeConsumo(rebanho.id, insumo.id, {
            quantidadeDia: 40, dataInicio: diasAtras(5.5), lancamentoAutomatico: true,
        });
        await verificar();
        await criarMovimentacaoInsumo(insumo.id, { quantidade: 100, data: new Date() });

        const r = await verificar();

        expect(r.body.data.lancamentos).toBe(0);
        expect((await lancamentos(regime.id)).map((m) => Number(m.quantidade))).toEqual([40, 40, 20]);
        const saldo = await saldoDoInsumo();
        expect(saldo.saldoReal).toBe(100);
        expect(saldo.consumoProjetado).toBe(0);   // o automático não é estimado: o servidor lança
        expect(saldo.saldoProjetado).toBe(100);
    });

    it('CONSAUTO-11 compra registrada depois, com a data em que chegou, cobre os dias desde ela', async () => {
        const regime = await criarRegimeConsumo(rebanho.id, insumo.id, {
            quantidadeDia: 40, dataInicio: diasAtras(5.5), lancamentoAutomatico: true,
        });
        await verificar();
        await criarMovimentacaoInsumo(insumo.id, { quantidade: 100, data: diasAtras(2) });

        await verificar();

        const lista = await lancamentos(regime.id);
        expect(lista.map((m) => Number(m.quantidade))).toEqual([40, 40, 20, 40, 40]);
        expect((await saldoDoInsumo()).saldoReal).toBe(20);
    });

    it('CONSAUTO-12 não lança o que deixaria o estoque negativo por uma saída registrada depois do dia', async () => {
        await criarMovimentacaoInsumo(insumo.id, {
            tipo: 'Saida', origem: 'Perda', quantidade: 90, data: diasAtras(0.2),
        });
        const regime = await criarRegimeConsumo(rebanho.id, insumo.id, {
            quantidadeDia: 20, dataInicio: diasAtras(3.5), lancamentoAutomatico: true,
        });

        await verificar();

        expect((await lancamentos(regime.id)).map((m) => Number(m.quantidade))).toEqual([10]);
        expect((await saldoDoInsumo()).saldoReal).toBe(0);
    });

    it('CONSAUTO-13 com dois lotes, o estoque vai para os dias em ordem de data', async () => {
        await criarMovimentacaoInsumo(insumo.id, { tipo: 'Saida', origem: 'Perda', quantidade: 50, data: diasAtras(29) });
        const outro = await criarRebanho(propriedade.id, pasto.id, { nomeRebanho: 'Novilhas' });
        const primeiro = await criarRegimeConsumo(rebanho.id, insumo.id, {
            quantidadeDia: 20, dataInicio: diasAtras(3.5), lancamentoAutomatico: true,
        });
        const segundo = await criarRegimeConsumo(outro.id, insumo.id, {
            quantidadeDia: 20, dataInicio: diasAtras(3.2), lancamentoAutomatico: true,
        });

        await verificar();

        expect((await lancamentos(primeiro.id)).map((m) => Number(m.quantidade))).toEqual([20, 10]);
        expect((await lancamentos(segundo.id)).map((m) => Number(m.quantidade))).toEqual([20]);
        expect((await saldoDoInsumo()).saldoReal).toBe(0);
    });
});
