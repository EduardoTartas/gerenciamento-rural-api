import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import DbConnect from '../../../src/config/dbConnect.js';
import { api } from '../../apoio/cliente.js';
import { criarUsuario } from '../../apoio/auth.js';
import {
    criarInsumo,
    criarPasto,
    criarPropriedade,
    criarRebanho,
    criarTipoManejoPasto,
    criarTipoManejoRebanho,
} from '../../apoio/fabricas.js';
import {
    criarManejoPasto,
    criarManejoRebanho,
    criarMovimentacaoInsumo,
    criarRegimeConsumo,
} from './apoio-local.js';

describe('POST /v1/sync — conflito de edição em cada entidade', () => {
    let a, propriedade, pasto, rebanho, insumo;

    beforeEach(async () => {
        a = await criarUsuario();
        propriedade = await criarPropriedade(a.id);
        pasto = await criarPasto(propriedade.id);
        rebanho = await criarRebanho(propriedade.id, pasto.id);
        insumo = await criarInsumo(propriedade.id);
    });

    const casos = [
        ['propriedades', 'propriedade', () => propriedade.id, { nome: 'Fazenda editada' }],
        ['pastos', 'pasto', () => pasto.id, { nome: 'Pasto editado' }],
        ['rebanhos', 'rebanho', () => rebanho.id, { nomeRebanho: 'Lote editado' }],
        ['insumos', 'insumo', () => insumo.id, { nome: 'Insumo editado' }],
        ['manejo_pastos', 'manejoPasto', async () => {
            const tipo = await criarTipoManejoPasto();
            return (await criarManejoPasto(pasto.id, tipo.id)).id;
        }, { observacoes: 'editado' }],
        ['manejo_rebanhos', 'manejoRebanho', async () => {
            const tipo = await criarTipoManejoRebanho();
            return (await criarManejoRebanho(rebanho.id, tipo.id)).id;
        }, { observacoes: 'editado' }],
        ['movimentacoes_insumo', 'movimentacaoInsumo', async () =>
            (await criarMovimentacaoInsumo(insumo.id, { origem: 'Compra' })).id, { observacoes: 'editado' }],
        ['regimes_consumo_insumo', 'regimeConsumoInsumo', async () =>
            (await criarRegimeConsumo(rebanho.id, insumo.id)).id, { quantidadeDia: 7 }],
    ];

    const sync = (mutacoes) =>
        api().post('/v1/sync').set('Authorization', a.bearer).send({ mutacoes });

    it.each(casos)('SYNC-POST-VER-20 %s: versão base antiga é conflito e a atual é aceita', async (entidade, modelo, obterId, dados) => {
        const entidadeId = await obterId();
        const mutacao = (versaoBase) => ({
            id: randomUUID(), entidade, acao: 'UPDATE', entidadeId, dados, versaoBase,
        });

        // outra edição entrou no servidor: a versão passa para 2.
        await DbConnect.prisma[modelo].update({ where: { id: entidadeId }, data: { versao: 2 } });

        const conflito = await sync([mutacao(1)]);
        expect(conflito.body.data.resultados[0]).toMatchObject({
            situacao: 'conflito', entidade, entidadeId, versaoBase: 1, versaoServidor: 2,
        });

        const aceito = await sync([mutacao(2)]);
        expect(aceito.body.data.resultados[0]).toMatchObject({ situacao: 'aceito', dados: { versao: 3 } });
    });
});
