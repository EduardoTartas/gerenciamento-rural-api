import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import DbConnect from '../../../src/config/dbConnect.js';
import { api } from '../../apoio/cliente.js';
import { criarUsuario } from '../../apoio/auth.js';
import { criarPropriedade, criarPasto, criarRebanho, criarTipoInsumo, criarInsumo } from '../../apoio/fabricas.js';

describe('POST /v1/insumos/movimentacoes', () => {
    let a;
    let propriedade;
    let insumo;

    beforeEach(async () => {
        a = await criarUsuario();
        propriedade = await criarPropriedade(a.id);
        const tipoInsumo = await criarTipoInsumo();
        insumo = await criarInsumo(propriedade.id, { tipoInsumoId: tipoInsumo.id });
    });

    const post = (usuario, corpo) =>
        api().post('/v1/insumos/movimentacoes').set('Authorization', usuario.bearer).send(corpo);

    const corpoValido = (extra = {}) => ({
        insumoId: insumo.id,
        tipo: 'Entrada',
        quantidade: 10,
        data: new Date().toISOString(),
        origem: 'Compra',
        ...extra,
    });

    it('MINS-POST-01 cria movimentação Entrada válida', async () => {
        const r = await post(a, corpoValido());
        expect(r.status).toBe(201);
        expect(r.body.errors).toEqual([]);
        expect(r.body.data.id).toBeDefined();
        expect(r.body.data.tipo).toBe('Entrada');
        expect(r.body.data.ativo).toBe(true);
        const salvo = await DbConnect.prisma.movimentacaoInsumo.findUnique({ where: { id: r.body.data.id } });
        expect(salvo).not.toBeNull();
        expect(salvo.insumoId).toBe(insumo.id);
    });

    it('MINS-POST-02 cria movimentação Saida válida', async () => {
        const r = await post(a, corpoValido({ tipo: 'Saida', origem: 'Perda' }));
        expect(r.status).toBe(201);
        expect(r.body.data.tipo).toBe('Saida');
    });

    it('MINS-POST-03 Ajuste legado negativo vira saída AjusteContagem (app antigo)', async () => {
        const r = await post(a, corpoValido({ tipo: 'Ajuste', quantidade: -12, origem: 'AjusteContagem', observacoes: 'contei' }));
        expect(r.status).toBe(201);
        expect(r.body.data.tipo).toBe('Saida');
        expect(Number(r.body.data.quantidade)).toBe(12);
        expect(r.body.data.origem).toBe('AjusteContagem');
        expect(r.body.data.observacoes).toBe('contei');
    });

    it('MINS-POST-04 aceita id gerado pelo cliente (offline-first)', async () => {
        const id = randomUUID();
        const r = await post(a, corpoValido({ id }));
        expect(r.status).toBe(201);
        expect(r.body.data.id).toBe(id);
    });

    it('MINS-POST-05 aceita rebanhoId da mesma propriedade do insumo', async () => {
        const pasto = await criarPasto(propriedade.id);
        const rebanho = await criarRebanho(propriedade.id, pasto.id);
        const r = await post(a, corpoValido({ tipo: 'Saida', origem: 'ConsumoRebanho', rebanhoId: rebanho.id }));
        expect(r.status).toBe(201);
        expect(r.body.data.rebanhoId).toBe(rebanho.id);
    });

    it('MINS-POST-06 aceita pastoId da mesma propriedade do insumo', async () => {
        const pasto = await criarPasto(propriedade.id);
        const r = await post(a, corpoValido({ tipo: 'Saida', origem: 'Perda', pastoId: pasto.id }));
        expect(r.status).toBe(201);
        expect(r.body.data.pastoId).toBe(pasto.id);
    });

    it('MINS-POST-07 aceita observacoes (até 500 caracteres)', async () => {
        const observacoes = 'o'.repeat(500);
        const r = await post(a, corpoValido({ observacoes }));
        expect(r.status).toBe(201);
        expect(r.body.data.observacoes).toBe(observacoes);
    });

    it('MINS-POST-08 corpo vazio', async () => {
        const r = await post(a, {});
        expect(r.status).toBe(400);
        expect(r.body.message).toBe('Forneça os dados da movimentação.');
    });

    it('MINS-POST-09 campo extra no corpo (.strict())', async () => {
        const r = await post(a, corpoValido({ extra: 1 }));
        expect(r.status).toBe(400);
        expect(r.body.tipo).toBe('validationError');
    });

    it('MINS-POST-10 insumoId ausente', async () => {
        const { insumoId: _omitido, ...corpo } = corpoValido();
        const r = await post(a, corpo);
        expect(r.status).toBe(400);
        expect(r.body.tipo).toBe('validationError');
        expect(r.body.errors[0].path).toBe('insumoId');
    });

    it('MINS-POST-11 tipo ausente ou fora do enum', async () => {
        const r = await post(a, corpoValido({ tipo: 'Invalido' }));
        expect(r.status).toBe(400);
        expect(r.body.tipo).toBe('validationError');
        expect(r.body.errors[0].path).toBe('tipo');
    });

    it('MINS-POST-12 quantidade ausente ou não numérica', async () => {
        const r = await post(a, corpoValido({ quantidade: 'abc' }));
        expect(r.status).toBe(400);
        expect(r.body.tipo).toBe('validationError');
        expect(r.body.errors[0].path).toBe('quantidade');
    });

    it('MINS-POST-13 quantidade = 0', async () => {
        const r = await post(a, corpoValido({ quantidade: 0 }));
        expect(r.status).toBe(400);
        // ZodError bruto: mensagem específica do refinamento vive em
        // errors[0].message, não em `message` (genérica) — ver Divergências no .md.
        expect(r.body.errors[0].message).toBe('Quantidade deve ser maior que zero.');
        expect(r.body.errors[0].path).toBe('quantidade');
    });

    it('MINS-POST-14 quantidade negativa em Entrada', async () => {
        const r = await post(a, corpoValido({ tipo: 'Entrada', quantidade: -5 }));
        expect(r.status).toBe(400);
        expect(r.body.errors[0].message).toBe('Quantidade deve ser maior que zero.');
    });

    it('MINS-POST-15 quantidade negativa em Saida', async () => {
        const r = await post(a, corpoValido({ tipo: 'Saida', quantidade: -5, origem: 'Perda' }));
        expect(r.status).toBe(400);
        expect(r.body.errors[0].message).toBe('Quantidade deve ser maior que zero.');
    });

    it('MINS-POST-16 data no futuro (mais de 5 minutos)', async () => {
        const data = new Date(Date.now() + 10 * 60 * 1000).toISOString();
        const r = await post(a, corpoValido({ data }));
        expect(r.status).toBe(400);
        expect(r.body.errors[0].message).toBe('A data não pode ser no futuro.');
    });

    it('MINS-POST-17 data até 5 minutos no futuro (tolerância do relógio do app offline)', async () => {
        const data = new Date(Date.now() + 2 * 60 * 1000).toISOString();
        const r = await post(a, corpoValido({ data }));
        expect(r.status).toBe(201);
    });

    it('MINS-POST-18 origem fora do enum', async () => {
        const r = await post(a, corpoValido({ origem: 'Invalida' }));
        expect(r.status).toBe(400);
        expect(r.body.tipo).toBe('validationError');
        expect(r.body.errors[0].path).toBe('origem');
    });

    it('MINS-POST-19 origem ManejoRebanho ou ManejoPasto', async () => {
        const r = await post(a, corpoValido({ origem: 'ManejoRebanho' }));
        expect(r.status).toBe(400);
        expect(r.body.tipo).toBe('validationError');
        expect(r.body.errors[0].path).toBe('origem');
    });

    it('MINS-POST-20 rebanhoId com formato inválido (não UUID)', async () => {
        const r = await post(a, corpoValido({ tipo: 'Saida', origem: 'ConsumoRebanho', rebanhoId: 'nao-e-uuid' }));
        expect(r.status).toBe(400);
        expect(r.body.tipo).toBe('validationError');
    });

    it('MINS-POST-21 sem token', async () => {
        const r = await api().post('/v1/insumos/movimentacoes').send(corpoValido());
        expect(r.status).toBe(401);
        expect(r.body.tipo).toBe('unauthorized');
    });

    it('MINS-POST-22 insumoId de A, logado como B', async () => {
        const b = await criarUsuario();
        const r = await post(b, corpoValido());
        expect(r.status).toBe(404);
        expect(r.body.message).toBe('Insumo não encontrado ou não pertence ao usuário autenticado.');
        const movs = await DbConnect.prisma.movimentacaoInsumo.findMany({ where: { insumoId: insumo.id } });
        expect(movs).toHaveLength(0);
    });

    it('MINS-POST-23 insumoId inexistente', async () => {
        const r = await post(a, corpoValido({ insumoId: randomUUID() }));
        expect(r.status).toBe(404);
        expect(r.body.message).toBe('Insumo não encontrado ou não pertence ao usuário autenticado.');
    });

    it('MINS-POST-24 rebanhoId de outro usuário (B)', async () => {
        const b = await criarUsuario();
        const propriedadeB = await criarPropriedade(b.id);
        const pastoB = await criarPasto(propriedadeB.id);
        const rebanhoB = await criarRebanho(propriedadeB.id, pastoB.id);

        const r = await post(a, corpoValido({ tipo: 'Saida', origem: 'ConsumoRebanho', rebanhoId: rebanhoB.id }));
        expect(r.status).toBe(400);
        expect(r.body.tipo).toBe('validationError');
        expect(r.body.message).toBe('Rebanho não encontrado ou não pertence ao usuário autenticado.');
        expect(r.body.errors[0].path).toBe('rebanhoId');
    });

    it('MINS-POST-25 rebanhoId de propriedade diferente da do insumo', async () => {
        const outraPropriedade = await criarPropriedade(a.id);
        const pasto = await criarPasto(outraPropriedade.id);
        const rebanho = await criarRebanho(outraPropriedade.id, pasto.id);

        const r = await post(a, corpoValido({ tipo: 'Saida', origem: 'ConsumoRebanho', rebanhoId: rebanho.id }));
        expect(r.status).toBe(400);
        expect(r.body.message).toBe('O rebanho pertence a outra propriedade.');
        expect(r.body.errors[0].path).toBe('rebanhoId');
    });

    it('MINS-POST-26 pastoId de outro usuário (B)', async () => {
        const b = await criarUsuario();
        const propriedadeB = await criarPropriedade(b.id);
        const pastoB = await criarPasto(propriedadeB.id);

        const r = await post(a, corpoValido({ tipo: 'Saida', origem: 'Perda', pastoId: pastoB.id }));
        expect(r.status).toBe(400);
        expect(r.body.message).toBe('Pasto não encontrado ou não pertence ao usuário autenticado.');
        expect(r.body.errors[0].path).toBe('pastoId');
    });

    it('MINS-POST-27 pastoId de propriedade diferente da do insumo', async () => {
        const outraPropriedade = await criarPropriedade(a.id);
        const pasto = await criarPasto(outraPropriedade.id);

        const r = await post(a, corpoValido({ tipo: 'Saida', origem: 'Perda', pastoId: pasto.id }));
        expect(r.status).toBe(400);
        expect(r.body.message).toBe('O pasto pertence a outra propriedade.');
        expect(r.body.errors[0].path).toBe('pastoId');
    });

    it('MINS-POST-28 motivos aceitos por tipo', async () => {
        const aceitos = [
            ['Entrada', 'Compra'], ['Entrada', 'CadastroInicial'], ['Entrada', 'Devolucao'],
            ['Saida', 'ConsumoRebanho'], ['Saida', 'Perda'],
        ];
        for (const [tipo, origem] of aceitos) {
            const r = await post(a, corpoValido({ tipo, origem }));
            expect(r.status, `${tipo}/${origem}`).toBe(201);
            expect(r.body.data.origem).toBe(origem);
        }
    });

    it('MINS-POST-29 motivo de outro tipo é recusado', async () => {
        for (const [tipo, origem] of [['Entrada', 'Perda'], ['Entrada', 'ConsumoRebanho'], ['Saida', 'Compra'], ['Saida', 'Devolucao']]) {
            const r = await post(a, corpoValido({ tipo, origem }));
            expect(r.status, `${tipo}/${origem}`).toBe(400);
            expect(r.body.errors[0].path).toBe('origem');
            expect(r.body.errors[0].message).toContain('Motivo inválido para');
        }
    });

    it('MINS-POST-30 "Outro" exige observação', async () => {
        for (const observacoes of [undefined, '   ']) {
            const r = await post(a, corpoValido({ tipo: 'Saida', origem: 'Outro', observacoes }));
            expect(r.status).toBe(400);
            expect(r.body.errors[0].path).toBe('observacoes');
        }
        const ok = await post(a, corpoValido({ tipo: 'Entrada', origem: 'Outro', observacoes: 'Doação do vizinho' }));
        expect(ok.status).toBe(201);
    });

    it('MINS-POST-31 Ajuste legado positivo vira entrada AjusteContagem; sem quantidade é recusado', async () => {
        const r = await post(a, corpoValido({ tipo: 'Ajuste', quantidade: 7, origem: 'AjusteContagem' }));
        expect(r.status).toBe(201);
        expect(r.body.data.tipo).toBe('Entrada');
        expect(Number(r.body.data.quantidade)).toBe(7);
        expect(r.body.data.origem).toBe('AjusteContagem');
        expect(r.body.data.observacoes).toBeNull();

        const zero = await post(a, corpoValido({ tipo: 'Ajuste', quantidade: 0, origem: 'AjusteContagem' }));
        expect(zero.status).toBe(400);
        expect(zero.body.errors[0].message).toBe('Ajuste sem quantidade não altera o estoque.');
    });

    it('MINS-POST-32 lançamento novo com AjusteContagem (fora do legado tipo Ajuste) é recusado', async () => {
        const r = await post(a, corpoValido({ tipo: 'Entrada', origem: 'AjusteContagem' }));
        expect(r.status).toBe(400);
        expect(r.body.errors[0].path).toBe('origem');
    });

    it('MINS-POST-33 entrada com valor pago grava valorTotal (issue #70)', async () => {
        const r = await post(a, corpoValido({ valorTotal: 1250.5 }));
        expect(r.status).toBe(201);
        expect(r.body.data.valorTotal).toBe('1250.5');
        const salvo = await DbConnect.prisma.movimentacaoInsumo.findUnique({ where: { id: r.body.data.id } });
        expect(Number(salvo.valorTotal)).toBe(1250.5);
    });

    it('MINS-POST-34 valor é opcional: sem ele ou nulo, fica nulo', async () => {
        const sem = await post(a, corpoValido());
        expect(sem.status).toBe(201);
        expect(sem.body.data.valorTotal).toBeNull();
        const nulo = await post(a, corpoValido({ origem: 'CadastroInicial', valorTotal: null }));
        expect(nulo.status).toBe(201);
        expect(nulo.body.data.valorTotal).toBeNull();
    });

    it('MINS-POST-35 saída com valor pago é recusada', async () => {
        const r = await post(a, corpoValido({ tipo: 'Saida', origem: 'Perda', valorTotal: 50 }));
        expect(r.status).toBe(400);
        expect(r.body.errors[0].path).toBe('valorTotal');
        expect(r.body.errors[0].message).toBe('O valor pago só pode ser informado em entrada de estoque.');
    });

    it('MINS-POST-36 valor zero, negativo ou texto é recusado', async () => {
        for (const valorTotal of [0, -10, '100']) {
            const r = await post(a, corpoValido({ valorTotal }));
            expect(r.status).toBe(400);
            expect(r.body.errors[0].path).toBe('valorTotal');
        }
    });
});
