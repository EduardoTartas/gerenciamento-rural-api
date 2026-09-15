import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import DbConnect from '../../../src/config/dbConnect.js';
import { api } from '../../apoio/cliente.js';
import { criarUsuario } from '../../apoio/auth.js';
import { criarPropriedade, criarTipoInsumo, criarInsumo } from '../../apoio/fabricas.js';

describe('POST /v1/insumos', () => {
    let a;
    let propriedade;
    let tipoInsumo;

    beforeEach(async () => {
        a = await criarUsuario();
        propriedade = await criarPropriedade(a.id);
        tipoInsumo = await criarTipoInsumo();
    });

    const post = (usuario, corpo) =>
        api().post('/v1/insumos').set('Authorization', usuario.bearer).send(corpo);

    const corpoValido = (extra = {}) => ({
        propriedadeId: propriedade.id,
        tipoInsumoId: tipoInsumo.id,
        nome: 'Ração Bovina',
        destino: 'Rebanho',
        unidadeMedida: 'kg',
        ...extra,
    });

    it('INS-POST-01 cria com dados válidos', async () => {
        const r = await post(a, corpoValido());
        expect(r.status).toBe(201);
        expect(r.body.errors).toEqual([]);
        expect(r.body.data.id).toBeDefined();
        expect(r.body.data.propriedadeId).toBe(propriedade.id);
        expect(r.body.data.saldo.saldoReal).toBe(0);
        expect(r.body.data.saldo.saldoProjetado).toBe(0);
        expect(r.body.data.saldo.esgotado).toBe(true);
        const salvo = await DbConnect.prisma.insumo.findUnique({ where: { id: r.body.data.id } });
        expect(salvo).not.toBeNull();
    });

    it('INS-POST-02 aceita id gerado pelo cliente (offline-first)', async () => {
        const id = randomUUID();
        const r = await post(a, corpoValido({ id }));
        expect(r.status).toBe(201);
        expect(r.body.data.id).toBe(id);
    });

    it('INS-POST-03 aceita estoqueMinimo', async () => {
        const r = await post(a, corpoValido({ estoqueMinimo: 15 }));
        expect(r.status).toBe(201);
        // Decimal do Prisma serializa como string no JSON (sem conversão global p/ Number).
        expect(Number(r.body.data.estoqueMinimo)).toBe(15);
    });

    it('INS-POST-04 estoqueMinimo negativo', async () => {
        const r = await post(a, corpoValido({ estoqueMinimo: -5 }));
        expect(r.status).toBe(400);
        expect(r.body.tipo).toBe('validationError');
        expect(r.body.errors[0].path).toBe('estoqueMinimo');
    });

    it('INS-POST-05 corpo vazio', async () => {
        const r = await post(a, {});
        expect(r.status).toBe(400);
        expect(r.body.message).toBe('Forneça os dados do insumo.');
    });

    it('INS-POST-06 campo extra no corpo (.strict())', async () => {
        const r = await post(a, corpoValido({ extra: 1 }));
        expect(r.status).toBe(400);
        expect(r.body.tipo).toBe('validationError');
    });

    it('INS-POST-07 propriedadeId ausente', async () => {
        const { propriedadeId: _omitido, ...corpo } = corpoValido();
        const r = await post(a, corpo);
        expect(r.status).toBe(400);
        expect(r.body.errors[0].path).toBe('propriedadeId');
    });

    it('INS-POST-08 tipoInsumoId ausente', async () => {
        const { tipoInsumoId: _omitido, ...corpo } = corpoValido();
        const r = await post(a, corpo);
        expect(r.status).toBe(400);
        expect(r.body.errors[0].path).toBe('tipoInsumoId');
    });

    it('INS-POST-09 nome ausente ou com menos de 2 caracteres', async () => {
        const r = await post(a, corpoValido({ nome: 'R' }));
        expect(r.status).toBe(400);
        expect(r.body.errors[0].path).toBe('nome');
    });

    it('INS-POST-10 nome com mais de 120 caracteres', async () => {
        const r = await post(a, corpoValido({ nome: 'R'.repeat(121) }));
        expect(r.status).toBe(400);
        expect(r.body.errors[0].path).toBe('nome');
    });

    it('INS-POST-11 destino fora de Pasto/Rebanho/Ambos', async () => {
        const r = await post(a, corpoValido({ destino: 'Invalido' }));
        expect(r.status).toBe(400);
        expect(r.body.errors[0].path).toBe('destino');
    });

    it('INS-POST-12 unidadeMedida fora do enum', async () => {
        const r = await post(a, corpoValido({ unidadeMedida: 'tonelada' }));
        expect(r.status).toBe(400);
        expect(r.body.errors[0].path).toBe('unidadeMedida');
    });

    it('INS-POST-13 sem token', async () => {
        const r = await api().post('/v1/insumos').send(corpoValido());
        expect(r.status).toBe(401);
        expect(r.body.tipo).toBe('unauthorized');
        expect(r.body.recuperavel).toBe(true);
    });

    it('INS-POST-14 propriedadeId de A, logado como B', async () => {
        const b = await criarUsuario();
        const r = await post(b, corpoValido());
        expect(r.status).toBe(404);
        expect(r.body.message).toBe('Propriedade não encontrada ou não pertence ao usuário autenticado.');
        const insumos = await DbConnect.prisma.insumo.findMany({ where: { propriedadeId: propriedade.id } });
        expect(insumos).toHaveLength(0);
    });

    it('INS-POST-15 propriedadeId inexistente', async () => {
        const r = await post(a, corpoValido({ propriedadeId: randomUUID() }));
        expect(r.status).toBe(404);
        expect(r.body.message).toBe('Propriedade não encontrada ou não pertence ao usuário autenticado.');
    });

    it('INS-POST-16 tipoInsumoId inexistente ou inativo', async () => {
        const tipoInativo = await criarTipoInsumo({ ativo: false });
        const r = await post(a, corpoValido({ tipoInsumoId: tipoInativo.id }));
        expect(r.status).toBe(404);
        expect(r.body.message).toBe('Tipo de insumo não encontrado.');
        expect(r.body.errors[0].path).toBe('tipoInsumoId');
    });

    it('INS-POST-17 nome duplicado (case-insensitive) entre insumos ativos da mesma propriedade', async () => {
        await criarInsumo(propriedade.id, { nome: 'Ração', tipoInsumoId: tipoInsumo.id });
        const r = await post(a, corpoValido({ nome: 'ração' }));
        expect(r.status).toBe(409);
        expect(r.body.tipo).toBe('conflict');
        expect(r.body.message).toBe('Já existe um insumo com este nome nesta propriedade.');
        expect(r.body.errors[0].path).toBe('nome');
    });

    it('INS-POST-18 nome igual ao de um insumo inativo da mesma propriedade', async () => {
        await criarInsumo(propriedade.id, { nome: 'Ração', tipoInsumoId: tipoInsumo.id, ativo: false });
        const r = await post(a, corpoValido({ nome: 'Ração' }));
        expect(r.status).toBe(201);
    });

    it('INS-POST-19 nome igual entre propriedades diferentes do mesmo usuário', async () => {
        const outraPropriedade = await criarPropriedade(a.id);
        await criarInsumo(propriedade.id, { nome: 'Ração', tipoInsumoId: tipoInsumo.id });
        const r = await post(a, corpoValido({ nome: 'Ração', propriedadeId: outraPropriedade.id }));
        expect(r.status).toBe(201);
    });
});
