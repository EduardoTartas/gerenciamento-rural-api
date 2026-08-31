import { describe, expect, it } from 'vitest';
import {
    calcularSaldoReal,
    calcularConsumoProjetadoNaoLancado,
    calcularConsumoDiaTotal,
    calcularSaldos,
    calcularSaldosComResumo,
} from '../../src/service/insumo/calculoSaldo.js';

const dia = (iso) => new Date(`${iso}T00:00:00Z`);

describe('calcularSaldoReal', () => {
    it('soma entrada, subtrai saida', () => {
        expect(calcularSaldoReal([
            { tipo: 'Entrada', quantidade: 100 },
            { tipo: 'Saida', quantidade: 30 },
            { tipo: 'Saida', quantidade: 20 },
        ])).toBe(50);
    });

    it('ajuste entra com o proprio sinal', () => {
        expect(calcularSaldoReal([
            { tipo: 'Entrada', quantidade: 100 },
            { tipo: 'Ajuste', quantidade: -12 },
            { tipo: 'Ajuste', quantidade: 5 },
        ])).toBe(93);
    });

    it('lista vazia da zero', () => {
        expect(calcularSaldoReal([])).toBe(0);
    });
});

describe('calcularConsumoProjetadoNaoLancado', () => {
    it('sem regimes, zero', () => {
        expect(calcularConsumoProjetadoNaoLancado([], [], dia('2026-08-28'))).toBe(0);
    });

    it('conta dias inteiros desde dataInicio quando nunca houve contagem', () => {
        const regimes = [{ quantidadeDia: 10, dataInicio: dia('2026-08-20'), dataFim: null }];
        // 8 dias de 20 a 28
        expect(calcularConsumoProjetadoNaoLancado(regimes, [], dia('2026-08-28'))).toBe(80);
    });

    it('a ultima contagem (AjusteContagem) reinicia o relogio', () => {
        const regimes = [{ quantidadeDia: 10, dataInicio: dia('2026-08-01'), dataFim: null }];
        const movs = [
            { origem: 'CadastroInicial', data: dia('2026-08-01') },
            { origem: 'AjusteContagem', data: dia('2026-08-25') },
        ];
        // conta de 25 a 28 = 3 dias
        expect(calcularConsumoProjetadoNaoLancado(regimes, movs, dia('2026-08-28'))).toBe(30);
    });

    it('respeita dataFim do regime', () => {
        const regimes = [{ quantidadeDia: 10, dataInicio: dia('2026-08-20'), dataFim: dia('2026-08-23') }];
        // 3 dias (20 a 23), mesmo consultando em 28
        expect(calcularConsumoProjetadoNaoLancado(regimes, [], dia('2026-08-28'))).toBe(30);
    });

    it('soma varios regimes do mesmo insumo', () => {
        const regimes = [
            { quantidadeDia: 10, dataInicio: dia('2026-08-26'), dataFim: null },
            { quantidadeDia: 2, dataInicio: dia('2026-08-26'), dataFim: null },
        ];
        // 2 dias * (10 + 2)
        expect(calcularConsumoProjetadoNaoLancado(regimes, [], dia('2026-08-28'))).toBe(24);
    });

    it('nunca negativo se a contagem e mais recente que agora', () => {
        const regimes = [{ quantidadeDia: 10, dataInicio: dia('2026-08-20'), dataFim: null }];
        const movs = [{ origem: 'AjusteContagem', data: dia('2026-08-30') }];
        expect(calcularConsumoProjetadoNaoLancado(regimes, movs, dia('2026-08-28'))).toBe(0);
    });
});

describe('calcularConsumoDiaTotal', () => {
    it('soma quantidadeDia dos regimes vigentes', () => {
        const regimes = [
            { quantidadeDia: 10, dataInicio: dia('2026-08-01'), dataFim: null, ativo: true },
            { quantidadeDia: 3, dataInicio: dia('2026-08-01'), dataFim: dia('2026-08-10'), ativo: false },
        ];
        expect(calcularConsumoDiaTotal(regimes, dia('2026-08-28'))).toBe(10);
    });
});

describe('calcularSaldos', () => {
    it('projeta saldo e previsao de termino', () => {
        const r = calcularSaldos({
            movimentacoes: [{ tipo: 'Entrada', quantidade: 100, origem: 'Compra', data: dia('2026-08-24') }],
            regimes: [{ quantidadeDia: 10, dataInicio: dia('2026-08-26'), dataFim: null, ativo: true }],
            agora: dia('2026-08-28'),
        });
        expect(r.saldoReal).toBe(100);
        expect(r.consumoProjetado).toBe(20); // 2 dias * 10
        expect(r.saldoProjetado).toBe(80);
        expect(r.consumoDiaTotal).toBe(10);
        expect(r.diasRestantes).toBe(8);
        expect(r.previsaoTermino).toBe('2026-09-05T00:00:00.000Z');
        expect(r.esgotado).toBe(false);
    });

    it('marca esgotado quando saldo projetado <= 0', () => {
        const r = calcularSaldos({
            movimentacoes: [{ tipo: 'Entrada', quantidade: 5, origem: 'Compra', data: dia('2026-08-01') }],
            regimes: [{ quantidadeDia: 10, dataInicio: dia('2026-08-20'), dataFim: null, ativo: true }],
            agora: dia('2026-08-28'),
        });
        expect(r.saldoProjetado).toBeLessThan(0);
        expect(r.esgotado).toBe(true);
        expect(r.previsaoTermino).toBeNull();
    });

    it('sem regimes, saldo projetado = saldo real e sem previsao', () => {
        const r = calcularSaldos({
            movimentacoes: [{ tipo: 'Entrada', quantidade: 40, origem: 'Compra', data: dia('2026-08-01') }],
            regimes: [],
            agora: dia('2026-08-28'),
        });
        expect(r.saldoProjetado).toBe(40);
        expect(r.consumoDiaTotal).toBe(0);
        expect(r.diasRestantes).toBeNull();
        expect(r.previsaoTermino).toBeNull();
    });
});

describe('calcularSaldosComResumo', () => {
    it('produz o mesmo pacote que calcularSaldos para o ledger equivalente', () => {
        const movimentacoes = [
            { tipo: 'Entrada', quantidade: 100, origem: 'Compra', data: dia('2026-08-24') },
            { tipo: 'Saida', quantidade: 12, origem: 'ManejoRebanho', data: dia('2026-08-25') },
            { tipo: 'Ajuste', quantidade: -3, origem: 'AjusteContagem', data: dia('2026-08-26') },
        ];
        const regimes = [{ quantidadeDia: 10, dataInicio: dia('2026-08-20'), dataFim: null, ativo: true }];
        const agora = dia('2026-08-28');

        const cru = calcularSaldos({ movimentacoes, regimes, agora });
        const resumido = calcularSaldosComResumo({
            resumo: { entrada: 100, saida: 12, ajuste: -3, ultimaContagem: dia('2026-08-26') },
            regimes,
            agora,
        });

        expect(resumido).toEqual(cru);
    });

    it('sem contagem, projeta desde o inicio de cada regime', () => {
        const r = calcularSaldosComResumo({
            resumo: { entrada: 100, saida: 0, ajuste: 0, ultimaContagem: null },
            regimes: [{ quantidadeDia: 10, dataInicio: dia('2026-08-26'), dataFim: null, ativo: true }],
            agora: dia('2026-08-28'),
        });
        expect(r.saldoReal).toBe(100);
        expect(r.consumoProjetado).toBe(20);
        expect(r.saldoProjetado).toBe(80);
        expect(r.previsaoTermino).toBe('2026-09-05T00:00:00.000Z');
    });

    it('resumo vazio da saldo zero', () => {
        const r = calcularSaldosComResumo({
            resumo: { entrada: 0, saida: 0, ajuste: 0, ultimaContagem: null },
            regimes: [],
            agora: dia('2026-08-28'),
        });
        expect(r.saldoReal).toBe(0);
        expect(r.saldoProjetado).toBe(0);
        expect(r.esgotado).toBe(true);
    });
});
