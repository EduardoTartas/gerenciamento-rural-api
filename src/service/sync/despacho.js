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
 * Assinatura única — `({ entidadeId, dados, req })` — para o laço do lote não
 * precisar saber qual ação está despachando. Acrescentar uma entidade é
 * acrescentar linhas aqui, não escrever um handler.
 *
 * `historico_movimentacoes` não tem `UPDATE`: movimentação é evento que
 * produziu efeito, e corrigir significa desfazer a última ou lançar outra.
 */
export const DESPACHO = {
    'propriedades:CREATE': ({ entidadeId, dados, req }) =>
        propriedade.create({ ...dados, id: entidadeId }, req),
    'propriedades:UPDATE': ({ entidadeId, dados, req }) =>
        propriedade.update(entidadeId, dados, req),
    'propriedades:DELETE': ({ entidadeId, req }) => propriedade.remove(entidadeId, req),

    'pastos:CREATE': ({ entidadeId, dados, req }) =>
        pasto.create({ ...dados, id: entidadeId }, req),
    'pastos:UPDATE': ({ entidadeId, dados, req }) => pasto.update(entidadeId, dados, req),
    'pastos:DELETE': ({ entidadeId, req }) => pasto.remove(entidadeId, req),

    'rebanhos:CREATE': ({ entidadeId, dados, req }) =>
        rebanho.create({ ...dados, id: entidadeId }, req),
    'rebanhos:UPDATE': ({ entidadeId, dados, req }) =>
        rebanho.update(entidadeId, dados, req),
    'rebanhos:DELETE': ({ entidadeId, req }) => rebanho.remove(entidadeId, req),

    'manejo_pastos:CREATE': ({ entidadeId, dados, req }) =>
        manejoPasto.create({ ...dados, id: entidadeId }, req),
    'manejo_pastos:UPDATE': ({ entidadeId, dados, req }) =>
        manejoPasto.update(entidadeId, dados, req),
    'manejo_pastos:DELETE': ({ entidadeId, req }) => manejoPasto.remove(entidadeId, req),

    'manejo_rebanhos:CREATE': ({ entidadeId, dados, req }) =>
        manejoRebanho.create({ ...dados, id: entidadeId }, req),
    'manejo_rebanhos:UPDATE': ({ entidadeId, dados, req }) =>
        manejoRebanho.update(entidadeId, dados, req),
    'manejo_rebanhos:DELETE': ({ entidadeId, req }) =>
        manejoRebanho.remove(entidadeId, req),

    'historico_movimentacoes:CREATE': ({ entidadeId, dados, req }) =>
        movimentacao.create({ ...dados, id: entidadeId }, req),
    'historico_movimentacoes:DELETE': ({ entidadeId, req }) =>
        movimentacao.remove(entidadeId, req),
};
