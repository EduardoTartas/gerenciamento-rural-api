// Avisos adicionais validados pelo produtor: véspera do pasto pronto, lote sem
// pasto, lote sem pesagem, resumo do mês e dados faltando (só caixa, uma vez
// por item).
import { beforeEach, describe, expect, it, vi } from 'vitest';
import DbConnect from '../../../src/config/dbConnect.js';
import { api } from '../../apoio/cliente.js';
import { criarUsuario } from '../../apoio/auth.js';
import { criarInsumo, criarPasto, criarPropriedade, criarRebanho } from '../../apoio/fabricas.js';
import { criarMovimentacaoInsumo } from '../sync/apoio-local.js';
import VerificacaoNotificacoesService from '../../../src/service/VerificacaoNotificacoesService.js';
import { diasAtras, reiniciarNpaasFalso } from './apoio-local.js';

const npaasFalso = vi.hoisted(() => ({
    ativo: true, enviar: vi.fn(), registrarDispositivo: vi.fn(), desativarToken: vi.fn(),
}));
vi.mock('../../../src/utils/npaas.js', async () => {
    const { moduloNpaasFalso } = await import('./apoio-local.js');
    return moduloNpaasFalso(npaasFalso);
});

const { prisma } = DbConnect;

describe('Verificação — avisos adicionais', () => {
    let a, fazenda, pasto;

    beforeEach(async () => {
        reiniciarNpaasFalso(npaasFalso);
        a = await criarUsuario();
        fazenda = await criarPropriedade(a.id, { nome: 'Fazenda Boa Vista' });
        pasto = await criarPasto(fazenda.id, { status: 'Ocupado', extensaoHa: 100 });
    });

    const verificar = () => api().post('/v1/notificacoes/verificar').set('Authorization', a.bearer);
    const doTipo = (tipo) =>
        prisma.notificacao.findMany({ where: { usuarioId: a.id, tipo }, orderBy: { createdAt: 'asc' } });

    it('NOVO-01 PASTO_PRONTO_AMANHA na véspera; ao concluir o descanso vira PASTO_PRONTO', async () => {
        const piquete = await criarPasto(fazenda.id, {
            nome: 'Piquete B', status: 'Descanso', extensaoHa: 10, dataUltimaSaida: diasAtras(29.5),
        });

        await verificar();

        const [vespera] = await doTipo('PASTO_PRONTO_AMANHA');
        expect(vespera).toMatchObject({
            entidadeId: piquete.id, rota: `/pastos/${piquete.id}`, pushStatus: 'enviado',
            titulo: 'Piquete B termina o descanso amanhã', mensagem: 'Planeje a mudança do lote.',
        });

        await prisma.pasto.update({ where: { id: piquete.id }, data: { dataUltimaSaida: diasAtras(30.5) } });
        await verificar();

        expect((await doTipo('PASTO_PRONTO_AMANHA'))[0].chaveAtiva).toBeNull();
        expect(await doTipo('PASTO_PRONTO')).toHaveLength(1);
    });

    it('NOVO-02 PASTO_PRONTO_AMANHA não avisa com mais de um dia de descanso pela frente', async () => {
        await criarPasto(fazenda.id, { status: 'Descanso', extensaoHa: 10, dataUltimaSaida: diasAtras(28) });

        await verificar();

        expect(await doTipo('PASTO_PRONTO_AMANHA')).toHaveLength(0);
    });

    it('NOVO-03 LOTE_SEM_PASTO: lote ativo sem pasto vinculado, com push', async () => {
        const lote = await criarRebanho(fazenda.id, null, { nomeRebanho: 'Bezerros' });
        await criarRebanho(fazenda.id, pasto.id);
        await criarRebanho(fazenda.id, null, { ativo: false });

        await verificar();

        const lista = await doTipo('LOTE_SEM_PASTO');
        expect(lista).toHaveLength(1);
        expect(lista[0]).toMatchObject({
            entidade: 'rebanho', entidadeId: lote.id, rota: `/rebanhos/${lote.id}`,
            titulo: 'Bezerros está sem pasto', pushStatus: 'enviado',
        });
    });

    it('NOVO-04 lote sem pesagem não gera aviso (retirado a pedido do produtor)', async () => {
        await criarRebanho(fazenda.id, pasto.id, { nomeRebanho: 'Novilhas', createdAt: diasAtras(200) });

        await verificar();

        expect(await doTipo('LOTE_SEM_PESAGEM')).toHaveLength(0);
    });

    describe('Dados faltando (só caixa, uma vez por item)', () => {
        it('NOVO-05 PASTO_SEM_AREA vai só para a caixa; resolvido, não reabre', async () => {
            const semArea = await criarPasto(fazenda.id, { nome: 'Pasto do Fundo' });

            await verificar();

            const [n] = await doTipo('PASTO_SEM_AREA');
            expect(n).toMatchObject({
                entidadeId: semArea.id, rota: `/pastos/${semArea.id}`, pushStatus: 'somenteCaixa',
                titulo: 'Pasto do Fundo sem área cadastrada',
            });
            expect(npaasFalso.enviar).not.toHaveBeenCalled();

            await prisma.pasto.update({ where: { id: semArea.id }, data: { extensaoHa: 12 } });
            await verificar();
            expect((await doTipo('PASTO_SEM_AREA'))[0].chaveAtiva).toBeNull();

            await prisma.pasto.update({ where: { id: semArea.id }, data: { extensaoHa: null } });
            await verificar();
            expect(await doTipo('PASTO_SEM_AREA')).toHaveLength(1);
        });

        it('NOVO-06 LOTE_SEM_VALOR_COMPRA: lote vendido ou finalizado sem valor de compra', async () => {
            const vendido = await criarRebanho(fazenda.id, pasto.id, { nomeRebanho: 'Boi gordo', quantidadeCabecas: 10 });
            await prisma.saidaRebanho.create({
                data: { rebanhoId: vendido.id, motivo: 'Venda', quantidadeCabecas: 5, valorTotal: 15000 },
            });
            const finalizado = await criarRebanho(fazenda.id, null, { ativo: false, quantidadeCabecas: 0 });
            await prisma.saidaRebanho.create({
                data: { rebanhoId: finalizado.id, motivo: 'Morte', quantidadeCabecas: 1, finalizouRebanho: true },
            });
            const comCompra = await criarRebanho(fazenda.id, pasto.id, { valorCompra: 20000 });
            await prisma.saidaRebanho.create({ data: { rebanhoId: comCompra.id, motivo: 'Venda', quantidadeCabecas: 1 } });
            // Saída que não é venda nem finalizou: ainda não é hora de cobrar o custo.
            const morte = await criarRebanho(fazenda.id, pasto.id, { quantidadeCabecas: 10 });
            await prisma.saidaRebanho.create({ data: { rebanhoId: morte.id, motivo: 'Morte', quantidadeCabecas: 1 } });

            await verificar();

            const lista = await doTipo('LOTE_SEM_VALOR_COMPRA');
            expect(lista.map((n) => n.entidadeId).sort()).toEqual([vendido.id, finalizado.id].sort());
            expect(lista.every((n) => n.pushStatus === 'somenteCaixa')).toBe(true);
            expect(lista.find((n) => n.entidadeId === vendido.id).titulo).toBe('Boi gordo sem valor de compra');

            await prisma.rebanho.update({ where: { id: vendido.id }, data: { valorCompra: 30000 } });
            await verificar();
            const resolvido = (await doTipo('LOTE_SEM_VALOR_COMPRA')).find((n) => n.entidadeId === vendido.id);
            expect(resolvido.chaveAtiva).toBeNull();
        });

        it('NOVO-07 INSUMO_SEM_PRECO: consumo no mês sem nenhuma entrada com valor pago', async () => {
            const semPreco = await criarInsumo(fazenda.id, { nome: 'Sal proteinado' });
            await criarMovimentacaoInsumo(semPreco.id, { quantidade: 100, data: diasAtras(40) });
            await criarMovimentacaoInsumo(semPreco.id, { tipo: 'Saida', origem: 'ConsumoRebanho', quantidade: 5 });
            const comPreco = await criarInsumo(fazenda.id);
            await criarMovimentacaoInsumo(comPreco.id, { quantidade: 100, valorTotal: 300, data: diasAtras(40) });
            await criarMovimentacaoInsumo(comPreco.id, { tipo: 'Saida', origem: 'ConsumoRebanho', quantidade: 5 });
            // Sem consumo no mês (só perda): nada a custear.
            const parado = await criarInsumo(fazenda.id);
            await criarMovimentacaoInsumo(parado.id, { quantidade: 100, data: diasAtras(40) });
            await criarMovimentacaoInsumo(parado.id, { tipo: 'Saida', origem: 'Perda', quantidade: 5 });

            await verificar();

            const lista = await doTipo('INSUMO_SEM_PRECO');
            expect(lista).toHaveLength(1);
            expect(lista[0]).toMatchObject({
                entidadeId: semPreco.id, rota: `/insumos/${semPreco.id}`, pushStatus: 'somenteCaixa',
                titulo: 'Sal proteinado sem preço de compra',
            });
        });
    });

    describe('RESUMO_MES', () => {
        const servico = new VerificacaoNotificacoesService();
        // 1º de novembro, 10h em Cuiabá: resumo de outubro.
        const PRIMEIRO_DE_NOVEMBRO = new Date('2026-11-01T14:00:00Z');

        const saida = (rebanhoId, dados) =>
            prisma.saidaRebanho.create({ data: { rebanhoId, quantidadeCabecas: 1, motivo: 'Venda', ...dados } });

        it('NOVO-08 no dia 1, resume as saídas do mês anterior por fazenda, no fuso da fazenda', async () => {
            const lote = await criarRebanho(fazenda.id, pasto.id, { quantidadeCabecas: 50, valorCompra: 1 });
            await saida(lote.id, { quantidadeCabecas: 10, valorTotal: 30000, dataSaida: new Date('2026-10-15T12:00:00Z') });
            // 31/10 às 23h em Cuiabá: ainda é outubro.
            await saida(lote.id, { motivo: 'Morte', quantidadeCabecas: 2, dataSaida: new Date('2026-11-01T03:00:00Z') });
            // 30/09 às 23h em Cuiabá: setembro, fora do resumo.
            await saida(lote.id, { quantidadeCabecas: 7, valorTotal: 9999, dataSaida: new Date('2026-10-01T03:00:00Z') });
            // Outra fazenda sem saídas no mês: sem resumo.
            await criarPropriedade(a.id);

            await servico.verificarUsuario(a.id, { agora: PRIMEIRO_DE_NOVEMBRO });

            const lista = await doTipo('RESUMO_MES');
            expect(lista).toHaveLength(1);
            expect(lista[0]).toMatchObject({
                entidade: 'propriedade', entidadeId: fazenda.id, propriedadeId: fazenda.id, rota: '/home/relatorio',
                titulo: 'Resumo de outubro na Fazenda Boa Vista',
                chaveAtiva: `${a.id}:RESUMO_MES:2026-10:${fazenda.id}`,
                pushStatus: 'enviado',
            });
            expect(lista[0].mensagem).toMatch(/^Vendidas 10 cabeças por R\$\s30\.000,00\. Outras saídas: 2 cabeças\. Veja o relatório\.$/);
        });

        it('NOVO-09 não duplica no mesmo dia e não se resolve no dia seguinte', async () => {
            const lote = await criarRebanho(fazenda.id, pasto.id, { quantidadeCabecas: 50, valorCompra: 1 });
            await saida(lote.id, { quantidadeCabecas: 3, dataSaida: new Date('2026-10-20T12:00:00Z') });

            await servico.verificarUsuario(a.id, { agora: PRIMEIRO_DE_NOVEMBRO });
            await servico.verificarUsuario(a.id, { agora: new Date('2026-11-01T18:00:00Z') });
            await servico.verificarUsuario(a.id, { agora: new Date('2026-11-02T14:00:00Z') });

            const lista = await doTipo('RESUMO_MES');
            expect(lista).toHaveLength(1);
            expect(lista[0].chaveAtiva).not.toBeNull();
            expect(lista[0].mensagem).toBe('Vendidas 3 cabeças. Veja o relatório.');
            const pushes = npaasFalso.enviar.mock.calls.filter(([, p]) => p.dados.tipo === 'RESUMO_MES');
            expect(pushes).toHaveLength(1);
        });

        it('NOVO-10 mês sem venda nem saída não gera resumo; fora do dia 1 também não', async () => {
            const lote = await criarRebanho(fazenda.id, pasto.id, { quantidadeCabecas: 50, valorCompra: 1 });

            await servico.verificarUsuario(a.id, { agora: PRIMEIRO_DE_NOVEMBRO });
            expect(await doTipo('RESUMO_MES')).toHaveLength(0);

            await saida(lote.id, { dataSaida: new Date('2026-10-20T12:00:00Z') });
            await servico.verificarUsuario(a.id, { agora: new Date('2026-11-02T14:00:00Z') });
            expect(await doTipo('RESUMO_MES')).toHaveLength(0);
        });
    });
});
