import { beforeEach, describe, expect, it, vi } from 'vitest';
import DbConnect from '../../../src/config/dbConnect.js';
import { api } from '../../apoio/cliente.js';
import { criarUsuario } from '../../apoio/auth.js';
import { criarInsumo, criarPasto, criarPropriedade, criarRebanho, criarSistemaProducao } from '../../apoio/fabricas.js';
import { criarMovimentacaoInsumo, criarRegimeConsumo } from '../sync/apoio-local.js';
import VerificacaoNotificacoesService, { dentroDoHorarioDePush } from '../../../src/service/VerificacaoNotificacoesService.js';
import { diasAtras, reiniciarNpaasFalso } from './apoio-local.js';

const npaasFalso = vi.hoisted(() => ({
    ativo: true, enviar: vi.fn(), registrarDispositivo: vi.fn(), desativarToken: vi.fn(),
}));
vi.mock('../../../src/utils/npaas.js', async () => {
    const { moduloNpaasFalso } = await import('./apoio-local.js');
    return moduloNpaasFalso(npaasFalso);
});

const { prisma } = DbConnect;

/** Hoje às 23h e às 10h em Cuiabá (UTC-4): fora e dentro da janela de push. */
function hojeAs(horaUtc) {
    const d = new Date();
    d.setUTCHours(horaUtc, 0, 0, 0);
    return d;
}
const NOITE = () => hojeAs(3);
const DIA = () => hojeAs(14);

describe('Verificação dos avisos da fazenda — POST /v1/notificacoes/verificar', () => {
    let a, fazenda;

    beforeEach(async () => {
        reiniciarNpaasFalso(npaasFalso);
        a = await criarUsuario();
        fazenda = await criarPropriedade(a.id);
    });

    const verificar = (usuario = a) =>
        api().post('/v1/notificacoes/verificar').set('Authorization', usuario.bearer);
    const notificacoes = (usuarioId = a.id) =>
        prisma.notificacao.findMany({ where: { usuarioId }, orderBy: { createdAt: 'asc' } });
    const pastoPronto = (dados = {}) =>
        criarPasto(fazenda.id, { status: 'Descanso', dataUltimaSaida: diasAtras(40), extensaoHa: 100, ...dados });

    describe('Situações avaliadas', () => {
        it('VERIF-01 PASTO_PRONTO: descanso concluído abre aviso com rota do pasto e envia push', async () => {
            const pasto = await pastoPronto({ nome: 'Piquete 3' });

            const r = await verificar();

            expect(r.status).toBe(200);
            expect(r.body.data).toMatchObject({ abertas: 1, resolvidas: 0, enviadas: 1 });
            const [n] = await notificacoes();
            expect(n).toMatchObject({
                tipo: 'PASTO_PRONTO', entidade: 'pasto', entidadeId: pasto.id, propriedadeId: fazenda.id,
                rota: `/pastos/${pasto.id}`, titulo: 'Piquete 3 pronto para receber gado', pushStatus: 'enviado',
            });
            expect(npaasFalso.enviar).toHaveBeenCalledWith(a.id, {
                titulo: 'Piquete 3 pronto para receber gado',
                corpo: n.mensagem,
                dados: { notificacaoId: n.id, tipo: 'PASTO_PRONTO', rota: `/pastos/${pasto.id}`, propriedadeId: fazenda.id, entidadeId: pasto.id },
            });
        });

        it('VERIF-02 PASTO_PRONTO respeita o descanso do pasto e ignora pasto ocupado, sem data ou inativo', async () => {
            await pastoPronto({ diasDescanso: 45 });              // 40 de 45 dias: ainda não
            await pastoPronto({ status: 'Ocupado' });
            await pastoPronto({ dataUltimaSaida: null });
            await pastoPronto({ ativo: false });
            const pronto = await pastoPronto({ diasDescanso: 35 });

            await verificar();

            const lista = await notificacoes();
            expect(lista.map((n) => n.entidadeId)).toEqual([pronto.id]);
        });

        it('VERIF-03 OCUPACAO_LONGA: lote há mais de 7 dias no piquete; 7 dias ainda não', async () => {
            const pasto = await criarPasto(fazenda.id, { nome: 'Piquete 1', status: 'Ocupado', extensaoHa: 100 });
            const longo = await criarRebanho(fazenda.id, pasto.id, { nomeRebanho: 'Garrotes', dataEntradaPastoAtual: diasAtras(10) });
            await criarRebanho(fazenda.id, pasto.id, { dataEntradaPastoAtual: diasAtras(7) });

            await verificar();

            const lista = await notificacoes();
            expect(lista).toHaveLength(1);
            expect(lista[0]).toMatchObject({
                tipo: 'OCUPACAO_LONGA', entidade: 'rebanho', entidadeId: longo.id,
                rota: `/rebanhos/${longo.id}`, titulo: 'Garrotes há 10 dias no Piquete 1',
            });
        });

        it('VERIF-04 LOTACAO_ALTA: mais de 2 UA/ha na fazenda, com peso estimado pelo sistema de produção', async () => {
            const recria = await criarSistemaProducao({ nome: 'Recria' });
            const pasto = await criarPasto(fazenda.id, { status: 'Ocupado', extensaoHa: 1 });
            // 3 cabeças × 300 kg ÷ 450 = 2,0 UA/ha: no limite, sem aviso.
            const lote = await criarRebanho(fazenda.id, pasto.id, { quantidadeCabecas: 3, sistemaProducaoId: recria.id });

            await verificar();
            expect(await notificacoes()).toHaveLength(0);

            // 4 cabeças → 2,7 UA/ha.
            await prisma.rebanho.update({ where: { id: lote.id }, data: { quantidadeCabecas: 4 } });
            await verificar();

            const lista = await notificacoes();
            expect(lista).toHaveLength(1);
            expect(lista[0]).toMatchObject({
                tipo: 'LOTACAO_ALTA', entidade: 'propriedade', entidadeId: fazenda.id, rota: '/pastos',
            });
            expect(lista[0].mensagem).toContain('2,7 UA/ha');
        });

        it('VERIF-05 INSUMO_ABAIXO_MINIMO: saldo no mínimo ou abaixo', async () => {
            const insumo = await criarInsumo(fazenda.id, { nome: 'Sal mineral', estoqueMinimo: 20 });
            await criarMovimentacaoInsumo(insumo.id, { quantidade: 10 });

            await verificar();

            const [n] = await notificacoes();
            expect(n).toMatchObject({
                tipo: 'INSUMO_ABAIXO_MINIMO', entidade: 'insumo', entidadeId: insumo.id,
                rota: `/insumos/${insumo.id}`, titulo: 'Sal mineral abaixo do mínimo',
            });
        });

        it('VERIF-06 INSUMO_ACABANDO: pelo consumo diário, dura até 7 dias', async () => {
            const pasto = await criarPasto(fazenda.id, { status: 'Ocupado', extensaoHa: 100 });
            const lote = await criarRebanho(fazenda.id, pasto.id);
            const insumo = await criarInsumo(fazenda.id, { nome: 'Ração' });
            await criarMovimentacaoInsumo(insumo.id, { quantidade: 100, valorTotal: 500 });
            await criarRegimeConsumo(lote.id, insumo.id, { quantidadeDia: 20, dataInicio: new Date() });

            await verificar();

            const [n] = await notificacoes();
            expect(n).toMatchObject({ tipo: 'INSUMO_ACABANDO', entidadeId: insumo.id, titulo: 'Ração está acabando' });
            expect(n.mensagem).toContain('5 dias');
        });

        it('VERIF-07 INSUMO_ESGOTADO vence os outros avisos do mesmo insumo; insumo sem entrada não avisa', async () => {
            const pasto = await criarPasto(fazenda.id, { status: 'Ocupado', extensaoHa: 100 });
            const lote = await criarRebanho(fazenda.id, pasto.id);
            const insumo = await criarInsumo(fazenda.id, { nome: 'Milho', estoqueMinimo: 50 });
            await criarMovimentacaoInsumo(insumo.id, { quantidade: 10, data: diasAtras(10), valorTotal: 50 });
            await criarRegimeConsumo(lote.id, insumo.id, { quantidadeDia: 5, dataInicio: diasAtras(10) });
            await criarInsumo(fazenda.id, { estoqueMinimo: 50 }); // nunca teve entrada

            await verificar();

            const lista = await notificacoes();
            expect(lista).toHaveLength(1);
            expect(lista[0]).toMatchObject({ tipo: 'INSUMO_ESGOTADO', entidadeId: insumo.id, titulo: 'Milho acabou' });
        });

        it('VERIF-08 fazenda inativa não é avaliada', async () => {
            await pastoPronto();
            await prisma.propriedade.update({ where: { id: fazenda.id }, data: { ativo: false } });

            await verificar();

            expect(await notificacoes()).toHaveLength(0);
        });
    });

    describe('Deduplicação, resolução e reaparecimento', () => {
        it('VERIF-09 verificar duas vezes não duplica notificação nem push', async () => {
            await pastoPronto();

            await verificar();
            const r = await verificar();

            expect(r.body.data).toMatchObject({ abertas: 0, enviadas: 0 });
            expect(await notificacoes()).toHaveLength(1);
            expect(npaasFalso.enviar).toHaveBeenCalledTimes(1);
        });

        it('VERIF-10 situação resolvida fica na caixa e libera a chave; se voltar, nasce outra', async () => {
            const pasto = await pastoPronto();
            await verificar();

            await prisma.pasto.update({ where: { id: pasto.id }, data: { status: 'Ocupado' } });
            const resolvida = await verificar();
            expect(resolvida.body.data.resolvidas).toBe(1);
            const [primeira] = await notificacoes();
            expect(primeira.chaveAtiva).toBeNull();
            expect(primeira.resolvidaEm).not.toBeNull();
            const caixa = await api().get('/v1/notificacoes').set('Authorization', a.bearer);
            expect(caixa.body.data.docs.map((n) => n.id)).toEqual([primeira.id]);

            await prisma.pasto.update({ where: { id: pasto.id }, data: { status: 'Descanso', dataUltimaSaida: diasAtras(40) } });
            const voltou = await verificar();

            expect(voltou.body.data.abertas).toBe(1);
            const lista = await notificacoes();
            expect(lista).toHaveLength(2);
            expect(lista[1].id).not.toBe(primeira.id);
            expect(npaasFalso.enviar).toHaveBeenCalledTimes(2);
        });

        it('VERIF-11 insumo que piora troca o aviso: o antigo se encerra e nasce o mais grave', async () => {
            const insumo = await criarInsumo(fazenda.id, { estoqueMinimo: 20 });
            const entrada = await criarMovimentacaoInsumo(insumo.id, { quantidade: 10 });
            await verificar();

            await prisma.movimentacaoInsumo.update({ where: { id: entrada.id }, data: { ativo: false } });
            await criarMovimentacaoInsumo(insumo.id, { quantidade: 10 });
            await criarMovimentacaoInsumo(insumo.id, { tipo: 'Saida', origem: 'Perda', quantidade: 10 });
            await verificar();

            const lista = await notificacoes();
            expect(lista.map((n) => [n.tipo, n.chaveAtiva === null])).toEqual([
                ['INSUMO_ABAIXO_MINIMO', true],
                ['INSUMO_ESGOTADO', false],
            ]);
        });

        it('VERIF-12 só avalia o usuário autenticado', async () => {
            const b = await criarUsuario();
            const fazendaB = await criarPropriedade(b.id);
            await criarPasto(fazendaB.id, { status: 'Descanso', dataUltimaSaida: diasAtras(40) });

            await verificar(a);

            expect(await notificacoes(b.id)).toHaveLength(0);
        });
    });

    describe('Push', () => {
        it('VERIF-13 NPaaS não configurado: notificação vai para a caixa e nenhum push é tentado', async () => {
            npaasFalso.ativo = false;
            await pastoPronto();

            const r = await verificar();

            expect(r.status).toBe(200);
            expect(r.body.data).toMatchObject({ abertas: 1, enviadas: 0 });
            const [n] = await notificacoes();
            expect(n.pushStatus).toBe('desligado');
            expect(npaasFalso.enviar).not.toHaveBeenCalled();
        });

        it('VERIF-14 NPaaS falhando: a verificação segue, o push volta para a fila e desiste após 3 tentativas', async () => {
            npaasFalso.enviar.mockResolvedValue(false);
            await pastoPronto();

            const r = await verificar();
            expect(r.status).toBe(200);
            let [n] = await notificacoes();
            expect(n).toMatchObject({ pushStatus: 'pendente', pushTentativas: 1 });

            await verificar();
            await verificar();
            [n] = await notificacoes();
            expect(n).toMatchObject({ pushStatus: 'falhou', pushTentativas: 3 });

            await verificar();
            expect(npaasFalso.enviar).toHaveBeenCalledTimes(3);
        });

        it('VERIF-15 mais de 3 pushes pendentes viram um push só de resumo', async () => {
            for (let i = 0; i < 4; i += 1) await pastoPronto();

            await verificar();

            expect(npaasFalso.enviar).toHaveBeenCalledTimes(1);
            const [, push] = npaasFalso.enviar.mock.calls[0];
            expect(push.titulo).toBe('4 avisos da fazenda');
            expect(push.dados).toMatchObject({ tipo: 'RESUMO', rota: '/notificacoes' });
            const lista = await notificacoes();
            expect(lista.every((n) => n.pushStatus === 'enviado')).toBe(true);
        });
    });

    describe('Horário de silêncio e verificação periódica', () => {
        const servico = new VerificacaoNotificacoesService();

        it('VERIF-16 janela de push: 6h às 21h no fuso de Cuiabá', () => {
            expect(dentroDoHorarioDePush(new Date('2026-10-09T09:59:00Z'))).toBe(false); // 05:59
            expect(dentroDoHorarioDePush(new Date('2026-10-09T10:00:00Z'))).toBe(true);  // 06:00
            expect(dentroDoHorarioDePush(new Date('2026-10-10T00:59:00Z'))).toBe(true);  // 20:59
            expect(dentroDoHorarioDePush(new Date('2026-10-10T01:00:00Z'))).toBe(false); // 21:00
        });

        it('VERIF-17 de madrugada a notificação entra na caixa e o push espera o horário', async () => {
            await pastoPronto();

            const noite = await servico.verificarUsuario(a.id, { agora: NOITE() });
            expect(noite).toMatchObject({ abertas: 1, enviadas: 0, foraDoHorario: true });
            let [n] = await notificacoes();
            expect(n.pushStatus).toBe('pendente');
            expect(npaasFalso.enviar).not.toHaveBeenCalled();

            const dia = await servico.verificarUsuario(a.id, { agora: DIA() });
            expect(dia).toMatchObject({ abertas: 0, enviadas: 1, foraDoHorario: false });
            [n] = await notificacoes();
            expect(n.pushStatus).toBe('enviado');
        });

        it('VERIF-18 situação resolvida antes do horário descarta o push que não saiu', async () => {
            const pasto = await pastoPronto();
            await servico.verificarUsuario(a.id, { agora: NOITE() });

            await prisma.pasto.update({ where: { id: pasto.id }, data: { status: 'Ocupado' } });
            await servico.verificarUsuario(a.id, { agora: DIA() });

            const [n] = await notificacoes();
            expect(n.pushStatus).toBe('descartado');
            expect(npaasFalso.enviar).not.toHaveBeenCalled();
        });

        it('VERIF-19 verificarTodos passa por todos os usuários e devolve push preso em envio para a fila', async () => {
            const b = await criarUsuario();
            const fazendaB = await criarPropriedade(b.id);
            await pastoPronto();
            await criarPasto(fazendaB.id, { status: 'Descanso', dataUltimaSaida: diasAtras(40), extensaoHa: 100 });
            await servico.verificarUsuario(a.id, { agora: NOITE() });
            const [presa] = await notificacoes();
            await prisma.notificacao.update({
                where: { id: presa.id },
                data: { pushStatus: 'enviando', updatedAt: diasAtras(1) },
            });

            const total = await servico.verificarTodos({ agora: DIA() });

            expect(total).toMatchObject({ usuarios: 2, abertas: 1, enviadas: 2, falhas: 0 });
            expect((await notificacoes(a.id))[0].pushStatus).toBe('enviado');
            expect((await notificacoes(b.id))[0].pushStatus).toBe('enviado');
        });
    });
});
