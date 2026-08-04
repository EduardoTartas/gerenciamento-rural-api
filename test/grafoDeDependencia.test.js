import { describe, expect, it } from 'vitest';
import {
    descendentes,
    ordenarPorDependencia,
} from '../src/service/sync/grafoDeDependencia.js';

/**
 * A cadeia pasto → rebanho → movimentação existe na fila do aplicativo. O
 * servidor precisa respeitá-la para não devolver 404 em cascata, que esconde a
 * causa real da falha.
 */
describe('grafo de dependência do lote', () => {
    const m = (id, dependeDe = null) => ({ id, dependeDe });

    it('mantém a ordem quando não há dependência', () => {
        const { ordem, erro } = ordenarPorDependencia([m('a'), m('b'), m('c')]);
        expect(erro).toBeNull();
        expect(ordem).toEqual(['a', 'b', 'c']);
    });

    it('coloca o predecessor antes do dependente', () => {
        const { ordem, erro } = ordenarPorDependencia([
            m('rebanho', 'pasto'),
            m('pasto'),
        ]);
        expect(erro).toBeNull();
        expect(ordem.indexOf('pasto')).toBeLessThan(ordem.indexOf('rebanho'));
    });

    it('resolve cadeia de três níveis', () => {
        const { ordem } = ordenarPorDependencia([
            m('movimentacao', 'rebanho'),
            m('rebanho', 'pasto'),
            m('pasto'),
        ]);
        expect(ordem).toEqual(['pasto', 'rebanho', 'movimentacao']);
    });

    it('recusa ciclo', () => {
        const { erro } = ordenarPorDependencia([m('a', 'b'), m('b', 'a')]);
        expect(erro).toMatch(/ciclo/i);
    });

    it('recusa dependência ausente do lote', () => {
        const { erro } = ordenarPorDependencia([m('a', 'naoEstaNoLote')]);
        expect(erro).toMatch(/naoEstaNoLote/);
    });

    it('lista todos os descendentes de uma mutação', () => {
        const mutacoes = [
            m('pasto'),
            m('rebanho', 'pasto'),
            m('movimentacao', 'rebanho'),
            m('outroPasto'),
        ];
        expect(descendentes(mutacoes, 'pasto')).toEqual(
            new Set(['rebanho', 'movimentacao']),
        );
    });

    it('mutação sem dependentes devolve conjunto vazio', () => {
        expect(descendentes([m('a'), m('b')], 'a')).toEqual(new Set());
    });
});
