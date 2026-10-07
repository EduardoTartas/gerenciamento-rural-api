import { beforeEach, describe, expect, it } from 'vitest';
import DbConnect from '../../../src/config/dbConnect.js';
import { api } from '../../apoio/cliente.js';
import { criarUsuario } from '../../apoio/auth.js';
import { criarPropriedade, criarTipoInsumo, criarInsumo } from '../../apoio/fabricas.js';
import { criarMovimentacaoInsumo } from './apoio-local.js';

describe('PATCH /v1/insumos/movimentacoes/:id', () => {
    let a;
    let propriedade;
    let insumo;

    beforeEach(async () => {
        a = await criarUsuario();
        propriedade = await criarPropriedade(a.id);
        const tipoInsumo = await criarTipoInsumo();
        insumo = await criarInsumo(propriedade.id, { tipoInsumoId: tipoInsumo.id });
    });

    const patch = (usuario, id, corpo) =>
        api().patch(`/v1/insumos/movimentacoes/${id}`).set('Authorization', usuario.bearer).send(corpo);

    const salva = (id) => DbConnect.prisma.movimentacaoInsumo.findUnique({ where: { id } });

    it('MINS-PATCH-ID-01 edita quantidade, data, motivo e observação', async () => {
        const mov = await criarMovimentacaoInsumo(insumo.id, { tipo: 'Entrada', quantidade: 100, origem: 'Compra' });
        const data = '2026-01-15T12:00:00.000Z';

        const r = await patch(a, mov.id, { quantidade: 80, data, origem: 'Devolucao', observacoes: 'voltou do vizinho' });
        expect(r.status).toBe(200);
        expect(r.body.message).toBe('Movimentação atualizada com sucesso.');
        expect(Number(r.body.data.quantidade)).toBe(80);
        expect(r.body.data.origem).toBe('Devolucao');
        expect(r.body.data.observacoes).toBe('voltou do vizinho');
        expect(r.body.data.tipo).toBe('Entrada');
        expect(r.body.data.insumoId).toBe(insumo.id);

        const banco = await salva(mov.id);
        expect(banco.data.toISOString()).toBe(data);

        const doInsumo = await api().get(`/v1/insumos/${insumo.id}`).set('Authorization', a.bearer);
        expect(doInsumo.body.data.saldo.saldoReal).toBe(80);
    });

    it('MINS-PATCH-ID-02 avança updatedAt', async () => {
        const mov = await criarMovimentacaoInsumo(insumo.id);
        const antes = (await salva(mov.id)).updatedAt;

        const r = await patch(a, mov.id, { observacoes: 'nota 1' });
        expect(r.status).toBe(200);
        expect((await salva(mov.id)).updatedAt.getTime()).toBeGreaterThan(antes.getTime());
    });

    it('MINS-PATCH-ID-03 tipo e insumoId não são editáveis', async () => {
        const mov = await criarMovimentacaoInsumo(insumo.id);
        const outro = await criarInsumo(propriedade.id);

        for (const corpo of [{ tipo: 'Saida' }, { insumoId: outro.id }, { quantidade: 5, ativo: false }]) {
            const r = await patch(a, mov.id, corpo);
            expect(r.status).toBe(400);
            expect(r.body.tipo).toBe('validationError');
        }
        const banco = await salva(mov.id);
        expect(banco.tipo).toBe('Entrada');
        expect(banco.insumoId).toBe(insumo.id);
        expect(Number(banco.quantidade)).toBe(100);
    });

    it('MINS-PATCH-ID-04 corpo vazio', async () => {
        const mov = await criarMovimentacaoInsumo(insumo.id);
        const r = await patch(a, mov.id, {});
        expect(r.status).toBe(400);
        expect(r.body.tipo).toBe('validationError');
    });

    it('MINS-PATCH-ID-05 motivo de outro tipo', async () => {
        const entrada = await criarMovimentacaoInsumo(insumo.id, { tipo: 'Entrada', origem: 'Compra' });
        const r = await patch(a, entrada.id, { origem: 'Perda' });
        expect(r.status).toBe(400);
        expect(r.body.errors[0].path).toBe('origem');
        expect(r.body.message).toMatch(/^Motivo inválido para entrada/);

        const saida = await criarMovimentacaoInsumo(insumo.id, { tipo: 'Saida', origem: 'Perda' });
        const r2 = await patch(a, saida.id, { origem: 'Compra' });
        expect(r2.status).toBe(400);
        expect(r2.body.message).toMatch(/^Motivo inválido para saída/);
        expect((await salva(saida.id)).origem).toBe('Perda');
    });

    it('MINS-PATCH-ID-06 "Outro" exige observação no resultado da edição', async () => {
        const compra = await criarMovimentacaoInsumo(insumo.id, { origem: 'Compra' });
        const r = await patch(a, compra.id, { origem: 'Outro' });
        expect(r.status).toBe(400);
        expect(r.body.errors[0].path).toBe('observacoes');

        const outro = await criarMovimentacaoInsumo(insumo.id, { origem: 'Outro', observacoes: 'doação' });
        const r2 = await patch(a, outro.id, { observacoes: null });
        expect(r2.status).toBe(400);
        expect(r2.body.errors[0].path).toBe('observacoes');

        const r3 = await patch(a, outro.id, { quantidade: 7 });
        expect(r3.status).toBe(200);
        expect(r3.body.data.observacoes).toBe('doação');
    });

    it('MINS-PATCH-ID-07 quantidade não positiva ou data no futuro', async () => {
        const mov = await criarMovimentacaoInsumo(insumo.id);
        const futuro = new Date(Date.now() + 60 * 60 * 1000).toISOString();

        for (const corpo of [{ quantidade: 0 }, { quantidade: -3 }, { data: futuro }]) {
            const r = await patch(a, mov.id, corpo);
            expect(r.status).toBe(400);
            expect(r.body.tipo).toBe('validationError');
        }
    });

    it('MINS-PATCH-ID-08 gerada por manejo não se edita aqui', async () => {
        const mov = await criarMovimentacaoInsumo(insumo.id, { tipo: 'Saida', origem: 'ManejoRebanho', quantidade: 4 });
        const r = await patch(a, mov.id, { quantidade: 2 });
        expect(r.status).toBe(400);
        expect(r.body.message).toBe('Lançamento gerado por manejo: edite pelo manejo.');
        expect(Number((await salva(mov.id)).quantidade)).toBe(4);
    });

    it('MINS-PATCH-ID-09 contagem antiga é só leitura', async () => {
        const mov = await criarMovimentacaoInsumo(insumo.id, { tipo: 'Entrada', origem: 'AjusteContagem', quantidade: 5 });
        const r = await patch(a, mov.id, { quantidade: 6 });
        expect(r.status).toBe(400);
        expect(r.body.message).toBe('Contagem antiga não pode ser editada.');
    });

    it('MINS-PATCH-ID-10 multi-tenancy: B edita movimentação de A', async () => {
        const mov = await criarMovimentacaoInsumo(insumo.id);
        const b = await criarUsuario();
        const r = await patch(b, mov.id, { quantidade: 1 });
        expect(r.status).toBe(404);
        expect(r.body.message).toBe('Recurso não encontrado em Movimentação de Insumo.');
        expect(Number((await salva(mov.id)).quantidade)).toBe(100);
    });

    it('MINS-PATCH-ID-11 movimentação inativa', async () => {
        const mov = await criarMovimentacaoInsumo(insumo.id, { ativo: false });
        const r = await patch(a, mov.id, { quantidade: 1 });
        expect(r.status).toBe(404);
        expect(r.body.message).toBe('Recurso não encontrado em Movimentação de Insumo.');
    });

    it('MINS-PATCH-ID-13 observacoes null limpa a observação', async () => {
        const mov = await criarMovimentacaoInsumo(insumo.id, { origem: 'Compra', observacoes: 'nota 7' });
        const r = await patch(a, mov.id, { observacoes: null });
        expect(r.status).toBe(200);
        expect(r.body.data.observacoes).toBeNull();
        expect((await salva(mov.id)).observacoes).toBeNull();

        // Trocar para "Outro" e limpar no mesmo envio continua recusado.
        const r2 = await patch(a, mov.id, { origem: 'Outro', observacoes: null });
        expect(r2.status).toBe(400);
        expect(r2.body.errors[0].path).toBe('observacoes');
    });

    it('MINS-PATCH-ID-14 edita e limpa o valor pago da entrada (issue #70)', async () => {
        const mov = await criarMovimentacaoInsumo(insumo.id, { tipo: 'Entrada', origem: 'Compra' });
        const r = await patch(a, mov.id, { valorTotal: 480 });
        expect(r.status).toBe(200);
        expect(r.body.data.valorTotal).toBe('480');
        expect(Number((await salva(mov.id)).valorTotal)).toBe(480);

        const limpa = await patch(a, mov.id, { valorTotal: null });
        expect(limpa.status).toBe(200);
        expect(limpa.body.data.valorTotal).toBeNull();
        expect((await salva(mov.id)).valorTotal).toBeNull();
    });

    it('MINS-PATCH-ID-15 valor pago em saída ou inválido é recusado', async () => {
        const saida = await criarMovimentacaoInsumo(insumo.id, { tipo: 'Saida', origem: 'Perda', quantidade: 5 });
        const r = await patch(a, saida.id, { valorTotal: 30 });
        expect(r.status).toBe(400);
        expect(r.body.errors[0].path).toBe('valorTotal');
        expect((await salva(saida.id)).valorTotal).toBeNull();

        const entrada = await criarMovimentacaoInsumo(insumo.id);
        const zero = await patch(a, entrada.id, { valorTotal: 0 });
        expect(zero.status).toBe(400);
        expect(zero.body.errors[0].path).toBe('valorTotal');
    });

    it('MINS-PATCH-ID-12 sem token', async () => {
        const mov = await criarMovimentacaoInsumo(insumo.id);
        const r = await api().patch(`/v1/insumos/movimentacoes/${mov.id}`).send({ quantidade: 1 });
        expect(r.status).toBe(401);
        expect(r.body.tipo).toBe('unauthorized');
    });
});
