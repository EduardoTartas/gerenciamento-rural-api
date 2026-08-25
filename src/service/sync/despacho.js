// src/service/sync/despacho.js

import ManejoPastoService from '../ManejoPastoService.js';
import ManejoRebanhoService from '../ManejoRebanhoService.js';
import MovimentacaoService from '../MovimentacaoService.js';
import PastoService from '../PastoService.js';
import PropriedadeService from '../PropriedadeService.js';
import RebanhoService from '../RebanhoService.js';

const propriedade = new PropriedadeService();
const pasto = new PastoService();
const rebanho = new RebanhoService();
const manejoPasto = new ManejoPastoService();
const manejoRebanho = new ManejoRebanhoService();
const movimentacao = new MovimentacaoService();

/**
 * Liga `(entidade, ação)` ao método do service de domínio.
 *
 * Assinatura única — `({ entidadeId, dados, req, tx })` — para o laço do lote não
 * precisar saber qual ação está despachando. Acrescentar uma entidade é
 * acrescentar linhas aqui, não escrever um handler.
 *
 * `historico_movimentacoes` não tem `UPDATE`: movimentação é evento que
 * produziu efeito, e corrigir significa desfazer a última ou lançar outra.
 */
export const DESPACHO = {
    'propriedades:CREATE': ({ entidadeId, dados, req, tx }) =>
        propriedade.create({ ...dados, id: entidadeId }, req, tx),
    'propriedades:UPDATE': ({ entidadeId, dados, req, tx }) =>
        propriedade.update(entidadeId, dados, req, tx),
    'propriedades:DELETE': ({ entidadeId, req, tx }) => propriedade.remove(entidadeId, req, tx),

    'pastos:CREATE': ({ entidadeId, dados, req, tx }) =>
        pasto.create({ ...dados, id: entidadeId }, req, tx),
    'pastos:UPDATE': ({ entidadeId, dados, req, tx }) => pasto.update(entidadeId, dados, req, tx),
    'pastos:DELETE': ({ entidadeId, req, tx }) => pasto.remove(entidadeId, req, tx),

    'rebanhos:CREATE': ({ entidadeId, dados, req, tx }) =>
        rebanho.create({ ...dados, id: entidadeId }, req, tx),
    'rebanhos:UPDATE': ({ entidadeId, dados, req, tx }) =>
        rebanho.update(entidadeId, dados, req, tx),
    'rebanhos:DELETE': ({ entidadeId, req, tx }) => rebanho.remove(entidadeId, req, tx),

    'manejo_pastos:CREATE': ({ entidadeId, dados, req, tx }) =>
        manejoPasto.create({ ...dados, id: entidadeId }, req, tx),
    'manejo_pastos:UPDATE': ({ entidadeId, dados, req, tx }) =>
        manejoPasto.update(entidadeId, dados, req, tx),
    'manejo_pastos:DELETE': ({ entidadeId, req, tx }) => manejoPasto.remove(entidadeId, req, tx),

    'manejo_rebanhos:CREATE': ({ entidadeId, dados, req, tx }) =>
        manejoRebanho.create({ ...dados, id: entidadeId }, req, tx),
    'manejo_rebanhos:UPDATE': ({ entidadeId, dados, req, tx }) =>
        manejoRebanho.update(entidadeId, dados, req, tx),
    'manejo_rebanhos:DELETE': ({ entidadeId, req, tx }) =>
        manejoRebanho.remove(entidadeId, req, tx),

    'historico_movimentacoes:CREATE': ({ entidadeId, dados, req, tx }) =>
        movimentacao.create({ ...dados, id: entidadeId }, req, tx),
    'historico_movimentacoes:DELETE': ({ entidadeId, req, tx }) =>
        movimentacao.remove(entidadeId, req, tx),
};
