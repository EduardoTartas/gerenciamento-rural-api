import { describe, expect, it } from 'vitest';
import { DESPACHO } from '../src/service/sync/despacho.js';
import { SCHEMAS_DE_MUTACAO } from '../src/service/sync/validacao.js';

describe('sync — entidades de insumo', () => {
    it('DESPACHO cobre insumo, movimentacao e regime', () => {
        for (const chave of [
            'insumos:CREATE', 'insumos:UPDATE', 'insumos:DELETE',
            'movimentacoes_insumo:CREATE', 'movimentacoes_insumo:DELETE',
            'regimes_consumo_insumo:CREATE', 'regimes_consumo_insumo:UPDATE', 'regimes_consumo_insumo:DELETE',
        ]) {
            expect(typeof DESPACHO[chave], chave).toBe('function');
        }
    });

    it('movimentacao de insumo nao tem UPDATE no lote', () => {
        expect(DESPACHO['movimentacoes_insumo:UPDATE']).toBeUndefined();
    });

    it('SCHEMAS_DE_MUTACAO valida os corpos de create/update', () => {
        for (const chave of [
            'insumos:CREATE', 'insumos:UPDATE',
            'movimentacoes_insumo:CREATE',
            'regimes_consumo_insumo:CREATE', 'regimes_consumo_insumo:UPDATE',
        ]) {
            expect(SCHEMAS_DE_MUTACAO[chave], chave).toBeTruthy();
        }
    });

    it('o schema do lote rejeita campo estranho em insumos:CREATE', () => {
        const r = SCHEMAS_DE_MUTACAO['insumos:CREATE'].safeParse({
            propriedadeId: '11111111-1111-1111-1111-111111111111',
            tipoInsumoId: '22222222-2222-2222-2222-222222222222',
            nome: 'Ração', destino: 'Rebanho', unidadeMedida: 'kg', hackeado: true,
        });
        expect(r.success).toBe(false);
    });
});
