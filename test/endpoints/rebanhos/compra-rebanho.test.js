import { beforeEach, describe, expect, it } from 'vitest';
import DbConnect from '../../../src/config/dbConnect.js';
import { api } from '../../apoio/cliente.js';
import { criarUsuario } from '../../apoio/auth.js';
import { criarPropriedade, criarPasto, criarRebanho } from '../../apoio/fabricas.js';

// Compra do lote (issue #71): valor, peso, arroba, data e cabeças na compra,
// todos opcionais e independentes. O custo por cabeça é calculado no app.
describe('Rebanho — compra do lote', () => {
    let a;
    let propriedade;
    let pasto;

    beforeEach(async () => {
        a = await criarUsuario();
        propriedade = await criarPropriedade(a.id);
        pasto = await criarPasto(propriedade.id);
    });

    const post = (corpo) =>
        api().post('/v1/rebanhos').set('Authorization', a.bearer)
            .send({ propriedadeId: propriedade.id, nomeRebanho: 'Lote Compra', pastoAtualId: pasto.id, ...corpo });
    const patch = (id, corpo) =>
        api().patch(`/v1/rebanhos/${id}`).set('Authorization', a.bearer).send(corpo);

    const compra = {
        valorCompra: 120000,
        pesoCompraKg: 36000.5,
        precoArrobaCompra: 250,
        dataCompra: '2026-02-10T00:00:00.000Z',
        cabecasCompra: 120,
    };

    it('REB-COMPRA-01 cria com a compra completa e devolve os campos', async () => {
        const r = await post(compra);
        expect(r.status).toBe(201);
        expect(r.body.data.valorCompra).toBe('120000');
        expect(r.body.data.pesoCompraKg).toBe('36000.5');
        expect(r.body.data.precoArrobaCompra).toBe('250');
        expect(r.body.data.dataCompra).toBe('2026-02-10T00:00:00.000Z');
        expect(r.body.data.cabecasCompra).toBe(120);
        const salvo = await DbConnect.prisma.rebanho.findUnique({ where: { id: r.body.data.id } });
        expect(Number(salvo.valorCompra)).toBe(120000);
    });

    it('REB-COMPRA-02 cria sem compra: campos nulos', async () => {
        const r = await post({});
        expect(r.status).toBe(201);
        expect(r.body.data.valorCompra).toBeNull();
        expect(r.body.data.cabecasCompra).toBeNull();
        expect(r.body.data.dataCompra).toBeNull();
    });

    it('REB-COMPRA-03 só o valor, sem os demais (campos independentes)', async () => {
        const r = await post({ valorCompra: 50000 });
        expect(r.status).toBe(201);
        expect(r.body.data.valorCompra).toBe('50000');
        expect(r.body.data.pesoCompraKg).toBeNull();
    });

    it.each([
        ['valorCompra', 0],
        ['valorCompra', -10],
        ['pesoCompraKg', 0],
        ['precoArrobaCompra', -1],
        ['cabecasCompra', 0],
        ['cabecasCompra', 2.5],
    ])('REB-COMPRA-04 %s = %s → 400', async (campo, valor) => {
        const r = await post({ [campo]: valor });
        expect(r.status).toBe(400);
        expect(r.body.errors.map((e) => e.path)).toContain(campo);
    });

    it('REB-COMPRA-05 dataCompra no futuro → 400', async () => {
        const amanha = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
        const r = await post({ dataCompra: amanha });
        expect(r.status).toBe(400);
        expect(r.body.errors.map((e) => e.path)).toContain('dataCompra');
    });

    it('REB-COMPRA-06 PATCH informa a compra de um lote já cadastrado', async () => {
        const rebanho = await criarRebanho(propriedade.id, pasto.id);
        const r = await patch(rebanho.id, { valorCompra: 80000, cabecasCompra: 40 });
        expect(r.status).toBe(200);
        expect(r.body.data.valorCompra).toBe('80000');
        expect(r.body.data.cabecasCompra).toBe(40);
    });

    it('REB-COMPRA-07 PATCH com null limpa o campo', async () => {
        const criado = await post(compra);
        const r = await patch(criado.body.data.id, { valorCompra: null, dataCompra: null });
        expect(r.status).toBe(200);
        expect(r.body.data.valorCompra).toBeNull();
        expect(r.body.data.dataCompra).toBeNull();
        // O resto da compra fica.
        expect(r.body.data.cabecasCompra).toBe(120);
    });

    it('REB-COMPRA-08 PATCH com valor inválido → 400', async () => {
        const rebanho = await criarRebanho(propriedade.id, pasto.id);
        const r = await patch(rebanho.id, { precoArrobaCompra: 0 });
        expect(r.status).toBe(400);
        expect(r.body.errors.map((e) => e.path)).toContain('precoArrobaCompra');
    });

    it('REB-COMPRA-09 GET por id e lista devolvem a compra', async () => {
        const criado = await post(compra);
        const id = criado.body.data.id;
        const porId = await api().get(`/v1/rebanhos/${id}`).set('Authorization', a.bearer);
        expect(porId.status).toBe(200);
        expect(porId.body.data.valorCompra).toBe('120000');

        const lista = await api().get('/v1/rebanhos').query({ propriedadeId: propriedade.id })
            .set('Authorization', a.bearer);
        const item = lista.body.data.docs.find((d) => d.id === id);
        expect(item.precoArrobaCompra).toBe('250');
        expect(item.cabecasCompra).toBe(120);
    });
});
