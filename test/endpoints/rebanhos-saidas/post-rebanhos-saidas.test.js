import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import DbConnect from '../../../src/config/dbConnect.js';
import { api } from '../../apoio/cliente.js';
import { criarUsuario } from '../../apoio/auth.js';
import { criarPropriedade, criarPasto, criarRebanho } from '../../apoio/fabricas.js';

describe('POST /v1/rebanhos/saidas', () => {
    let a, propriedadeA, pastoA, rebanhoA;

    beforeEach(async () => {
        a = await criarUsuario();
        propriedadeA = await criarPropriedade(a.id);
        pastoA = await criarPasto(propriedadeA.id, { status: 'Ocupado' });
        rebanhoA = await criarRebanho(propriedadeA.id, pastoA.id, { quantidadeCabecas: 50 });
    });

    const post = (usuario, corpo) =>
        api().post('/v1/rebanhos/saidas').set('Authorization', usuario.bearer).send(corpo);

    // Venda exige preço da arroba e valor total (issue #66).
    const corpoBase = (extra = {}) => ({
        rebanhoId: rebanhoA.id,
        motivo: 'Venda',
        quantidadeCabecas: 10,
        precoArroba: 310,
        valorTotal: 50000,
        ...extra,
    });

    /** Corpo de saída que não é venda: sem os campos de valor. */
    const corpoSemVenda = (motivo, extra = {}) => {
        const { precoArroba, valorTotal, ...corpo } = corpoBase({ motivo });
        return { ...corpo, ...extra };
    };

    const rebanhoSalvo = () => DbConnect.prisma.rebanho.findUnique({ where: { id: rebanhoA.id } });
    const pastoSalvo = () => DbConnect.prisma.pasto.findUnique({ where: { id: pastoA.id } });

    it('SAI-POST-01 saída parcial baixa as cabeças e mantém o rebanho ativo', async () => {
        const r = await post(a, corpoBase());
        expect(r.status).toBe(201);
        expect(r.body.message).toBe('Saída registrada com sucesso.');
        expect(r.body.data.motivo).toBe('Venda');
        expect(r.body.data.quantidadeCabecas).toBe(10);
        expect(r.body.data.finalizouRebanho).toBe(false);
        expect(r.body.data.rebanho.quantidadeCabecas).toBe(40);
        expect(r.body.data.rebanho.ativo).toBe(true);

        const rebanho = await rebanhoSalvo();
        expect(rebanho.quantidadeCabecas).toBe(40);
        expect(rebanho.ativo).toBe(true);
        expect(rebanho.pastoAtualId).toBe(pastoA.id);
        expect((await pastoSalvo()).status).toBe('Ocupado');
    });

    it('SAI-POST-02 aceita id gerado pelo cliente (offline-first)', async () => {
        const id = randomUUID();
        const r = await post(a, corpoBase({ id }));
        expect(r.status).toBe(201);
        expect(r.body.data.id).toBe(id);
    });

    it('SAI-POST-03 saída total finaliza o rebanho e libera o pasto', async () => {
        const dataSaida = '2026-09-20T12:00:00.000Z';
        const r = await post(a, corpoSemVenda('Abate', { quantidadeCabecas: 50, dataSaida }));
        expect(r.status).toBe(201);
        expect(r.body.message).toBe('Saída registrada e rebanho finalizado.');
        expect(r.body.data.finalizouRebanho).toBe(true);
        expect(r.body.data.rebanho.ativo).toBe(false);

        const rebanho = await rebanhoSalvo();
        expect(rebanho.ativo).toBe(false);
        expect(rebanho.quantidadeCabecas).toBe(0);
        expect(rebanho.pastoAtualId).toBeNull();
        expect(rebanho.dataEntradaPastoAtual).toBeNull();

        const pasto = await pastoSalvo();
        expect(pasto.status).toBe('Descanso');
        expect(pasto.dataUltimaSaida.toISOString()).toBe(dataSaida);
    });

    it('SAI-POST-04 finalizar: true com saída parcial encerra o rebanho', async () => {
        const r = await post(a, corpoSemVenda('Morte', { quantidadeCabecas: 3, finalizar: true }));
        expect(r.status).toBe(201);
        expect(r.body.data.finalizouRebanho).toBe(true);

        const rebanho = await rebanhoSalvo();
        expect(rebanho.ativo).toBe(false);
        expect(rebanho.quantidadeCabecas).toBe(47);
        expect((await pastoSalvo()).status).toBe('Descanso');
    });

    it('SAI-POST-05 finalizar com outro lote no pasto mantém o pasto Ocupado', async () => {
        await criarRebanho(propriedadeA.id, pastoA.id, { quantidadeCabecas: 5 });
        const r = await post(a, corpoBase({ quantidadeCabecas: 50 }));
        expect(r.status).toBe(201);

        const pasto = await pastoSalvo();
        expect(pasto.status).toBe('Ocupado');
        expect(pasto.dataUltimaSaida).toBeNull();
    });

    it('SAI-POST-06 recalcula o pasto contando rebanhos, não lendo o status', async () => {
        await DbConnect.prisma.pasto.update({ where: { id: pastoA.id }, data: { status: 'Vazio' } });
        const r = await post(a, corpoBase({ quantidadeCabecas: 50 }));
        expect(r.status).toBe(201);
        expect((await pastoSalvo()).status).toBe('Descanso');
    });

    it('SAI-POST-07 quantidade acima das cabeças atuais', async () => {
        const r = await post(a, corpoBase({ quantidadeCabecas: 51 }));
        expect(r.status).toBe(409);
        expect(r.body.tipo).toBe('conflict');
        expect(r.body.recuperavel).toBe(false);
        expect(r.body.errors[0].path).toBe('quantidadeCabecas');
        expect(r.body.errors[0].message).toContain('o rebanho tem 50');

        expect((await rebanhoSalvo()).quantidadeCabecas).toBe(50);
        expect(await DbConnect.prisma.saidaRebanho.count()).toBe(0);
    });

    it('SAI-POST-08 rebanho sem quantidade: saída parcial é recusada', async () => {
        const semContagem = await criarRebanho(propriedadeA.id, pastoA.id, { quantidadeCabecas: null });
        const r = await post(a, corpoBase({ rebanhoId: semContagem.id }));
        expect(r.status).toBe(400);
        expect(r.body.errors[0].path).toBe('quantidadeCabecas');
        expect(r.body.errors[0].message).toContain('Preencha a quantidade de cabeças');
    });

    it('SAI-POST-09 rebanho sem quantidade: finalizar é aceito e mantém a contagem vazia', async () => {
        const semContagem = await criarRebanho(propriedadeA.id, pastoA.id, { quantidadeCabecas: null });
        const r = await post(a, corpoBase({ rebanhoId: semContagem.id, finalizar: true }));
        expect(r.status).toBe(201);
        expect(r.body.data.finalizouRebanho).toBe(true);

        const salvo = await DbConnect.prisma.rebanho.findUnique({ where: { id: semContagem.id } });
        expect(salvo.ativo).toBe(false);
        expect(salvo.quantidadeCabecas).toBeNull();
    });

    it('SAI-POST-10 rebanho inativo', async () => {
        const inativo = await criarRebanho(propriedadeA.id, null, { ativo: false, quantidadeCabecas: 10 });
        const r = await post(a, corpoBase({ rebanhoId: inativo.id, quantidadeCabecas: 1 }));
        expect(r.status).toBe(400);
        expect(r.body.errors[0].path).toBe('rebanhoId');
        expect(r.body.message).toContain('Rebanho está inativo');
    });

    it('SAI-POST-11 corpo vazio', async () => {
        const r = await post(a, {});
        expect(r.status).toBe(400);
        expect(r.body.errors[0].path).toBe('body');
    });

    it('SAI-POST-12 campo extra no corpo (.strict())', async () => {
        const r = await post(a, corpoBase({ valor: 100 }));
        expect(r.status).toBe(400);
        expect(r.body.tipo).toBe('validationError');
    });

    it('SAI-POST-13 motivo fora da lista', async () => {
        const r = await post(a, corpoSemVenda('Doação'));
        expect(r.status).toBe(400);
        expect(r.body.errors[0].message).toContain('Venda, Morte, Abate ou Outro');
    });

    it('SAI-POST-14 quantidade zero, negativa ou fracionada', async () => {
        for (const quantidadeCabecas of [0, -2, 1.5]) {
            const r = await post(a, corpoBase({ quantidadeCabecas }));
            expect(r.status).toBe(400);
            expect(r.body.errors[0].path).toBe('quantidadeCabecas');
        }
    });

    it('SAI-POST-15 falta quantidadeCabecas', async () => {
        const { quantidadeCabecas, ...corpo } = corpoBase();
        const r = await post(a, corpo);
        expect(r.status).toBe(400);
        expect(r.body.tipo).toBe('validationError');
    });

    it('SAI-POST-16 dataSaida no futuro', async () => {
        const r = await post(a, corpoBase({ dataSaida: '2999-01-01T00:00:00.000Z' }));
        expect(r.status).toBe(400);
        expect(r.body.errors[0].message).toContain('não pode ser no futuro');
    });

    it('SAI-POST-17 sem token', async () => {
        const r = await api().post('/v1/rebanhos/saidas').send(corpoBase());
        expect(r.status).toBe(401);
        expect(r.body.tipo).toBe('unauthorized');
    });

    it('SAI-POST-18 B tenta registrar saída do rebanho de A', async () => {
        const b = await criarUsuario();
        const r = await post(b, corpoBase());
        expect(r.status).toBe(404);
        expect(r.body.tipo).toBe('resourceNotFound');
        expect((await rebanhoSalvo()).quantidadeCabecas).toBe(50);
    });

    it('SAI-POST-19 admin (não dono) tenta registrar saída do rebanho de A', async () => {
        const admin = await criarUsuario({ admin: true });
        const r = await post(admin, corpoBase());
        expect(r.status).toBe(404);
        expect(r.body.tipo).toBe('resourceNotFound');
    });

    it('SAI-POST-20 rebanhoId inexistente', async () => {
        const r = await post(a, corpoBase({ rebanhoId: randomUUID() }));
        expect(r.status).toBe(404);
        expect(r.body.tipo).toBe('resourceNotFound');
    });

    it('SAI-POST-21 saídas concorrentes não tiram mais cabeças do que existem', async () => {
        const [r1, r2] = await Promise.all([
            post(a, corpoBase({ quantidadeCabecas: 30 })),
            post(a, corpoBase({ quantidadeCabecas: 30 })),
        ]);
        expect([r1.status, r2.status].sort()).toEqual([201, 409]);
        expect((await rebanhoSalvo()).quantidadeCabecas).toBe(20);
        expect(await DbConnect.prisma.saidaRebanho.count()).toBe(1);
    });

    it('SAI-POST-22 saídas em sequência acumulam a baixa até finalizar', async () => {
        await post(a, corpoBase({ quantidadeCabecas: 20 }));
        const r = await post(a, corpoSemVenda('Morte', { quantidadeCabecas: 30 }));
        expect(r.status).toBe(201);
        expect(r.body.data.finalizouRebanho).toBe(true);
        expect((await rebanhoSalvo()).ativo).toBe(false);
    });

    it('SAI-POST-23 venda grava preço da arroba, peso e valor total', async () => {
        const r = await post(a, corpoBase({ precoArroba: 312.5, pesoTotalKg: 5400, valorTotal: 110000 }));
        expect(r.status).toBe(201);
        expect(Number(r.body.data.precoArroba)).toBe(312.5);
        expect(Number(r.body.data.pesoTotalKg)).toBe(5400);
        expect(Number(r.body.data.valorTotal)).toBe(110000);
    });

    it('SAI-POST-24 venda aceita valor diferente de peso/15 x arroba (o negócio real manda)', async () => {
        // 5400 / 15 * 300 = 108000; vendido por 100000 com desconto.
        const r = await post(a, corpoBase({ precoArroba: 300, pesoTotalKg: 5400, valorTotal: 100000 }));
        expect(r.status).toBe(201);
        expect(Number(r.body.data.valorTotal)).toBe(100000);
    });

    it('SAI-POST-25 venda sem preço da arroba ou sem valor total', async () => {
        const { precoArroba, ...semPreco } = corpoBase();
        const r1 = await post(a, semPreco);
        expect(r1.status).toBe(400);
        expect(r1.body.errors[0].path).toBe('precoArroba');

        const { valorTotal, ...semValor } = corpoBase();
        const r2 = await post(a, semValor);
        expect(r2.status).toBe(400);
        expect(r2.body.errors[0].path).toBe('valorTotal');
        expect(await DbConnect.prisma.saidaRebanho.count()).toBe(0);
    });

    it('SAI-POST-26 morte com dados de venda é recusada', async () => {
        const r = await post(a, corpoSemVenda('Morte', { valorTotal: 1000 }));
        expect(r.status).toBe(400);
        expect(r.body.errors[0].path).toBe('valorTotal');
        expect(r.body.errors[0].message).toContain('só são informados quando o motivo é Venda');
    });

    it('SAI-POST-27 valores de venda zerados ou negativos', async () => {
        for (const extra of [{ precoArroba: 0 }, { valorTotal: -1 }, { pesoTotalKg: 0 }]) {
            const r = await post(a, corpoBase(extra));
            expect(r.status).toBe(400);
            expect(r.body.tipo).toBe('validationError');
        }
    });

    it('SAI-POST-28 abate sem dados de venda grava os campos nulos', async () => {
        const r = await post(a, corpoSemVenda('Abate', { quantidadeCabecas: 2 }));
        expect(r.status).toBe(201);
        expect(r.body.data.precoArroba).toBeNull();
        expect(r.body.data.valorTotal).toBeNull();
    });
});
