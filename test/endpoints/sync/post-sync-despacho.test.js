import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import DbConnect from '../../../src/config/dbConnect.js';
import { api } from '../../apoio/cliente.js';
import { criarUsuario } from '../../apoio/auth.js';
import {
    criarPropriedade, criarPasto, criarRebanho, criarTipoManejoPasto, criarTipoManejoRebanho,
    criarTipoInsumo, criarInsumo,
} from '../../apoio/fabricas.js';
import {
    criarManejoPasto, criarManejoRebanho, criarMovimentacaoInsumo, criarRegimeConsumo,
} from './apoio-local.js';

describe('POST /v1/sync — despacho por entidade/ação', () => {
    let a, propriedade;

    beforeEach(async () => {
        a = await criarUsuario();
        propriedade = await criarPropriedade(a.id);
    });

    const sync = (usuario, mutacoes) =>
        api().post('/v1/sync').set('Authorization', usuario.bearer).send({ mutacoes });

    const enviarUma = async (mutacao) => {
        const r = await sync(a, [mutacao]);
        return { r, res: r.body.data.resultados[0] };
    };

    it('SYNC-POST-38 propriedades:CREATE', async () => {
        const entidadeId = randomUUID();
        const { res } = await enviarUma({
            id: randomUUID(), entidade: 'propriedades', acao: 'CREATE', entidadeId,
            dados: { nome: 'Fazenda Sync' },
        });
        expect(res.situacao).toBe('aceito');
        const salvo = await DbConnect.prisma.propriedade.findUnique({ where: { id: entidadeId } });
        expect(salvo.usuarioId).toBe(a.id);
    });

    it('SYNC-POST-39 propriedades:UPDATE', async () => {
        const { res } = await enviarUma({
            id: randomUUID(), entidade: 'propriedades', acao: 'UPDATE', entidadeId: propriedade.id,
            dados: { nome: 'Fazenda Renomeada' },
        });
        expect(res.situacao).toBe('aceito');
        const salvo = await DbConnect.prisma.propriedade.findUnique({ where: { id: propriedade.id } });
        expect(salvo.nome).toBe('Fazenda Renomeada');
    });

    it('SYNC-POST-40 propriedades:DELETE', async () => {
        const { res } = await enviarUma({
            id: randomUUID(), entidade: 'propriedades', acao: 'DELETE', entidadeId: propriedade.id,
        });
        expect(res.situacao).toBe('aceito');
        const salvo = await DbConnect.prisma.propriedade.findUnique({ where: { id: propriedade.id } });
        expect(salvo.ativo).toBe(false);
    });

    it('SYNC-POST-41 pastos:CREATE', async () => {
        const entidadeId = randomUUID();
        const { res } = await enviarUma({
            id: randomUUID(), entidade: 'pastos', acao: 'CREATE', entidadeId,
            dados: { propriedadeId: propriedade.id, nome: 'Piquete Sync' },
        });
        expect(res.situacao).toBe('aceito');
        const salvo = await DbConnect.prisma.pasto.findUnique({ where: { id: entidadeId } });
        expect(salvo).not.toBeNull();
    });

    it('SYNC-POST-42 pastos:UPDATE', async () => {
        const pasto = await criarPasto(propriedade.id);
        const { res } = await enviarUma({
            id: randomUUID(), entidade: 'pastos', acao: 'UPDATE', entidadeId: pasto.id,
            dados: { nome: 'Piquete Renomeado' },
        });
        expect(res.situacao).toBe('aceito');
        const salvo = await DbConnect.prisma.pasto.findUnique({ where: { id: pasto.id } });
        expect(salvo.nome).toBe('Piquete Renomeado');
    });

    it('SYNC-POST-43 pastos:DELETE', async () => {
        const pasto = await criarPasto(propriedade.id);
        const { res } = await enviarUma({
            id: randomUUID(), entidade: 'pastos', acao: 'DELETE', entidadeId: pasto.id,
        });
        expect(res.situacao).toBe('aceito');
        const salvo = await DbConnect.prisma.pasto.findUnique({ where: { id: pasto.id } });
        expect(salvo.ativo).toBe(false);
    });

    it('SYNC-POST-44 rebanhos:CREATE', async () => {
        const pasto = await criarPasto(propriedade.id);
        const entidadeId = randomUUID();
        const { res } = await enviarUma({
            id: randomUUID(), entidade: 'rebanhos', acao: 'CREATE', entidadeId,
            dados: { propriedadeId: propriedade.id, pastoAtualId: pasto.id, nomeRebanho: 'Lote Sync' },
        });
        expect(res.situacao).toBe('aceito');
        const salvo = await DbConnect.prisma.rebanho.findUnique({ where: { id: entidadeId } });
        expect(salvo).not.toBeNull();
    });

    it('SYNC-POST-45 rebanhos:UPDATE', async () => {
        const pasto = await criarPasto(propriedade.id);
        const rebanho = await criarRebanho(propriedade.id, pasto.id);
        const { res } = await enviarUma({
            id: randomUUID(), entidade: 'rebanhos', acao: 'UPDATE', entidadeId: rebanho.id,
            dados: { nomeRebanho: 'Lote Renomeado' },
        });
        expect(res.situacao).toBe('aceito');
        const salvo = await DbConnect.prisma.rebanho.findUnique({ where: { id: rebanho.id } });
        expect(salvo.nomeRebanho).toBe('Lote Renomeado');
    });

    // Bug: `rebanhos:DELETE` chama `RebanhoService.remove` -> `_inativar`, que usa
    // `executor` fora de escopo (src/service/RebanhoService.js:187) -> ReferenceError.
    // O lote captura por item e devolve `recusado`. Comportamento correto esperado é
    // `aceito` com soft-delete efetivo (ver ## Divergências).
    it.fails('SYNC-POST-46 rebanhos:DELETE', async () => {
        const pasto = await criarPasto(propriedade.id);
        const rebanho = await criarRebanho(propriedade.id, pasto.id);
        const { res } = await enviarUma({
            id: randomUUID(), entidade: 'rebanhos', acao: 'DELETE', entidadeId: rebanho.id,
        });
        expect(res.situacao).toBe('aceito');
        const salvo = await DbConnect.prisma.rebanho.findUnique({ where: { id: rebanho.id } });
        expect(salvo.ativo).toBe(false);
    });

    it('SYNC-POST-47 manejo_pastos:CREATE', async () => {
        const pasto = await criarPasto(propriedade.id);
        const tipoManejo = await criarTipoManejoPasto();
        const entidadeId = randomUUID();
        const { res } = await enviarUma({
            id: randomUUID(), entidade: 'manejo_pastos', acao: 'CREATE', entidadeId,
            dados: { pastoId: pasto.id, tipoManejoId: tipoManejo.id, dataAtividade: '2026-01-01T00:00:00.000Z' },
        });
        expect(res.situacao).toBe('aceito');
        const salvo = await DbConnect.prisma.manejoPasto.findUnique({ where: { id: entidadeId } });
        expect(salvo).not.toBeNull();
    });

    it('SYNC-POST-48 manejo_pastos:UPDATE', async () => {
        const pasto = await criarPasto(propriedade.id);
        const tipoManejo = await criarTipoManejoPasto();
        const manejo = await criarManejoPasto(pasto.id, tipoManejo.id);
        const { res } = await enviarUma({
            id: randomUUID(), entidade: 'manejo_pastos', acao: 'UPDATE', entidadeId: manejo.id,
            dados: { observacoes: 'Atualizado pelo lote' },
        });
        expect(res.situacao).toBe('aceito');
        const salvo = await DbConnect.prisma.manejoPasto.findUnique({ where: { id: manejo.id } });
        expect(salvo.observacoes).toBe('Atualizado pelo lote');
    });

    it('SYNC-POST-49 manejo_pastos:DELETE', async () => {
        const pasto = await criarPasto(propriedade.id);
        const tipoManejo = await criarTipoManejoPasto();
        const manejo = await criarManejoPasto(pasto.id, tipoManejo.id);
        const { res } = await enviarUma({
            id: randomUUID(), entidade: 'manejo_pastos', acao: 'DELETE', entidadeId: manejo.id,
        });
        expect(res.situacao).toBe('aceito');
        // Exclusão lógica (ver Divergências no .md): ManejoPastoRepository.remove
        // faz update ativo:false, não delete físico.
        const salvo = await DbConnect.prisma.manejoPasto.findUnique({ where: { id: manejo.id } });
        expect(salvo).not.toBeNull();
        expect(salvo.ativo).toBe(false);
    });

    it('SYNC-POST-50 manejo_rebanhos:CREATE', async () => {
        const pasto = await criarPasto(propriedade.id);
        const rebanho = await criarRebanho(propriedade.id, pasto.id);
        const tipoManejo = await criarTipoManejoRebanho();
        const entidadeId = randomUUID();
        const { res } = await enviarUma({
            id: randomUUID(), entidade: 'manejo_rebanhos', acao: 'CREATE', entidadeId,
            dados: { rebanhoId: rebanho.id, tipoManejoId: tipoManejo.id, dataAtividade: '2026-01-01T00:00:00.000Z' },
        });
        expect(res.situacao).toBe('aceito');
        const salvo = await DbConnect.prisma.manejoRebanho.findUnique({ where: { id: entidadeId } });
        expect(salvo).not.toBeNull();
    });

    it('SYNC-POST-51 manejo_rebanhos:UPDATE', async () => {
        const pasto = await criarPasto(propriedade.id);
        const rebanho = await criarRebanho(propriedade.id, pasto.id);
        const tipoManejo = await criarTipoManejoRebanho();
        const manejo = await criarManejoRebanho(rebanho.id, tipoManejo.id);
        const { res } = await enviarUma({
            id: randomUUID(), entidade: 'manejo_rebanhos', acao: 'UPDATE', entidadeId: manejo.id,
            dados: { observacoes: 'Atualizado pelo lote' },
        });
        expect(res.situacao).toBe('aceito');
        const salvo = await DbConnect.prisma.manejoRebanho.findUnique({ where: { id: manejo.id } });
        expect(salvo.observacoes).toBe('Atualizado pelo lote');
    });

    it('SYNC-POST-52 manejo_rebanhos:DELETE', async () => {
        const pasto = await criarPasto(propriedade.id);
        const rebanho = await criarRebanho(propriedade.id, pasto.id);
        const tipoManejo = await criarTipoManejoRebanho();
        const manejo = await criarManejoRebanho(rebanho.id, tipoManejo.id);
        const { res } = await enviarUma({
            id: randomUUID(), entidade: 'manejo_rebanhos', acao: 'DELETE', entidadeId: manejo.id,
        });
        expect(res.situacao).toBe('aceito');
        // Exclusão lógica (ver Divergências no .md): ManejoRebanhoRepository.remove
        // faz update ativo:false, não delete físico.
        const salvo = await DbConnect.prisma.manejoRebanho.findUnique({ where: { id: manejo.id } });
        expect(salvo).not.toBeNull();
        expect(salvo.ativo).toBe(false);
    });

    it('SYNC-POST-53 historico_movimentacoes:CREATE', async () => {
        const pastoOrigem = await criarPasto(propriedade.id, { status: 'Ocupado' });
        const pastoDestino = await criarPasto(propriedade.id, { status: 'Vazio' });
        const rebanho = await criarRebanho(propriedade.id, pastoOrigem.id);
        const entidadeId = randomUUID();
        const { res } = await enviarUma({
            id: randomUUID(), entidade: 'historico_movimentacoes', acao: 'CREATE', entidadeId,
            dados: { rebanhoId: rebanho.id, pastoDestinoId: pastoDestino.id },
        });
        expect(res.situacao).toBe('aceito');

        const salvo = await DbConnect.prisma.historicoMovimentacao.findUnique({ where: { id: entidadeId } });
        expect(salvo).not.toBeNull();
        const rebanhoAtual = await DbConnect.prisma.rebanho.findUnique({ where: { id: rebanho.id } });
        expect(rebanhoAtual.pastoAtualId).toBe(pastoDestino.id);
        const pastoDestinoAtual = await DbConnect.prisma.pasto.findUnique({ where: { id: pastoDestino.id } });
        expect(pastoDestinoAtual.status).toBe('Ocupado');
    });

    it('SYNC-POST-54 historico_movimentacoes:DELETE (desfazer última movimentação)', async () => {
        const pastoOrigem = await criarPasto(propriedade.id, { status: 'Ocupado' });
        const pastoDestino = await criarPasto(propriedade.id, { status: 'Vazio' });
        const rebanho = await criarRebanho(propriedade.id, pastoOrigem.id);

        const criada = await api()
            .post('/v1/rebanhos/movimentacoes')
            .set('Authorization', a.bearer)
            .send({ rebanhoId: rebanho.id, pastoDestinoId: pastoDestino.id });
        expect(criada.status).toBe(201);
        const movimentacaoId = criada.body.data.id;

        const { res } = await enviarUma({
            id: randomUUID(), entidade: 'historico_movimentacoes', acao: 'DELETE', entidadeId: movimentacaoId,
        });
        expect(res.situacao).toBe('aceito');

        const salvo = await DbConnect.prisma.historicoMovimentacao.findUnique({ where: { id: movimentacaoId } });
        expect(salvo.ativo).toBe(false);
        const rebanhoAtual = await DbConnect.prisma.rebanho.findUnique({ where: { id: rebanho.id } });
        expect(rebanhoAtual.pastoAtualId).toBe(pastoOrigem.id);
    });

    it('SYNC-POST-55 insumos:CREATE', async () => {
        const tipoInsumo = await criarTipoInsumo();
        const entidadeId = randomUUID();
        const { res } = await enviarUma({
            id: randomUUID(), entidade: 'insumos', acao: 'CREATE', entidadeId,
            dados: {
                propriedadeId: propriedade.id, tipoInsumoId: tipoInsumo.id,
                nome: 'Ração Sync', destino: 'Ambos', unidadeMedida: 'kg',
            },
        });
        expect(res.situacao).toBe('aceito');
        const salvo = await DbConnect.prisma.insumo.findUnique({ where: { id: entidadeId } });
        expect(salvo).not.toBeNull();
    });

    it('SYNC-POST-56 insumos:UPDATE', async () => {
        const insumo = await criarInsumo(propriedade.id);
        const { res } = await enviarUma({
            id: randomUUID(), entidade: 'insumos', acao: 'UPDATE', entidadeId: insumo.id,
            dados: { nome: 'Insumo Renomeado' },
        });
        expect(res.situacao).toBe('aceito');
        const salvo = await DbConnect.prisma.insumo.findUnique({ where: { id: insumo.id } });
        expect(salvo.nome).toBe('Insumo Renomeado');
    });

    it('SYNC-POST-57 insumos:DELETE', async () => {
        const insumo = await criarInsumo(propriedade.id);
        const { res } = await enviarUma({
            id: randomUUID(), entidade: 'insumos', acao: 'DELETE', entidadeId: insumo.id,
        });
        expect(res.situacao).toBe('aceito');
        const salvo = await DbConnect.prisma.insumo.findUnique({ where: { id: insumo.id } });
        expect(salvo.ativo).toBe(false);
    });

    it('SYNC-POST-58 movimentacoes_insumo:CREATE', async () => {
        const insumo = await criarInsumo(propriedade.id);
        const entidadeId = randomUUID();
        const { res } = await enviarUma({
            id: randomUUID(), entidade: 'movimentacoes_insumo', acao: 'CREATE', entidadeId,
            dados: {
                insumoId: insumo.id, tipo: 'Entrada', quantidade: 10,
                data: '2026-01-01T00:00:00.000Z', origem: 'Compra',
            },
        });
        expect(res.situacao).toBe('aceito');
        const salvo = await DbConnect.prisma.movimentacaoInsumo.findUnique({ where: { id: entidadeId } });
        expect(salvo).not.toBeNull();
    });

    it('SYNC-POST-59 movimentacoes_insumo:DELETE', async () => {
        const insumo = await criarInsumo(propriedade.id);
        const mov = await criarMovimentacaoInsumo(insumo.id);
        const { res } = await enviarUma({
            id: randomUUID(), entidade: 'movimentacoes_insumo', acao: 'DELETE', entidadeId: mov.id,
        });
        expect(res.situacao).toBe('aceito');
        const salvo = await DbConnect.prisma.movimentacaoInsumo.findUnique({ where: { id: mov.id } });
        expect(salvo.ativo).toBe(false);
    });

    it('SYNC-POST-60 regimes_consumo_insumo:CREATE', async () => {
        const pasto = await criarPasto(propriedade.id);
        const rebanho = await criarRebanho(propriedade.id, pasto.id);
        const insumo = await criarInsumo(propriedade.id, { destino: 'Ambos' });
        const entidadeId = randomUUID();
        const { res } = await enviarUma({
            id: randomUUID(), entidade: 'regimes_consumo_insumo', acao: 'CREATE', entidadeId,
            dados: { rebanhoId: rebanho.id, insumoId: insumo.id, quantidadeDia: 3, dataInicio: '2026-01-01T00:00:00.000Z' },
        });
        expect(res.situacao).toBe('aceito');
        const salvo = await DbConnect.prisma.regimeConsumoInsumo.findUnique({ where: { id: entidadeId } });
        expect(salvo).not.toBeNull();
    });

    it('SYNC-POST-61 regimes_consumo_insumo:UPDATE', async () => {
        const pasto = await criarPasto(propriedade.id);
        const rebanho = await criarRebanho(propriedade.id, pasto.id);
        const insumo = await criarInsumo(propriedade.id, { destino: 'Ambos' });
        const regime = await criarRegimeConsumo(rebanho.id, insumo.id);
        const { res } = await enviarUma({
            id: randomUUID(), entidade: 'regimes_consumo_insumo', acao: 'UPDATE', entidadeId: regime.id,
            dados: { quantidadeDia: 9 },
        });
        expect(res.situacao).toBe('aceito');
        const salvo = await DbConnect.prisma.regimeConsumoInsumo.findUnique({ where: { id: regime.id } });
        expect(Number(salvo.quantidadeDia)).toBe(9);
    });

    it('SYNC-POST-62 regimes_consumo_insumo:DELETE', async () => {
        const pasto = await criarPasto(propriedade.id);
        const rebanho = await criarRebanho(propriedade.id, pasto.id);
        const insumo = await criarInsumo(propriedade.id, { destino: 'Ambos' });
        const regime = await criarRegimeConsumo(rebanho.id, insumo.id);
        const { res } = await enviarUma({
            id: randomUUID(), entidade: 'regimes_consumo_insumo', acao: 'DELETE', entidadeId: regime.id,
        });
        expect(res.situacao).toBe('aceito');
        const salvo = await DbConnect.prisma.regimeConsumoInsumo.findUnique({ where: { id: regime.id } });
        expect(salvo.ativo).toBe(false);
    });
});
