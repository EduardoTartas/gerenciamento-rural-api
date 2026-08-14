import { describe, expect, it } from 'vitest';
import { contemInsensitive, igualInsensitive, aplicarAtivoOuDiferenca, intervaloData } from '../src/utils/helpers/filtroPrisma.js';

describe('contemInsensitive', () => {
    it('monta o filtro de contains case-insensitive quando há valor', () => {
        expect(contemInsensitive('Angus')).toEqual({ contains: 'Angus', mode: 'insensitive' });
    });

    it('retorna undefined pra valor vazio, pra Prisma ignorar a chave', () => {
        expect(contemInsensitive('')).toBeUndefined();
        expect(contemInsensitive(undefined)).toBeUndefined();
        expect(contemInsensitive(null)).toBeUndefined();
    });
});

describe('igualInsensitive', () => {
    it('monta o filtro de igualdade case-insensitive quando há valor', () => {
        expect(igualInsensitive('Fazenda Boa Vista')).toEqual({ equals: 'Fazenda Boa Vista', mode: 'insensitive' });
    });

    it('retorna undefined pra valor vazio', () => {
        expect(igualInsensitive('')).toBeUndefined();
        expect(igualInsensitive(undefined)).toBeUndefined();
    });
});

describe('aplicarAtivoOuDiferenca', () => {
    it('sem atualizadoDesde e sem ativo explícito, filtra só os ativos', () => {
        const where = {};
        aplicarAtivoOuDiferenca(where, {});
        expect(where).toEqual({ ativo: true });
    });

    it('com atualizadoDesde, inclui os inativos (delta precisa das exclusões)', () => {
        const data = new Date('2026-01-01T00:00:00Z');
        const where = {};
        aplicarAtivoOuDiferenca(where, { atualizadoDesde: data });
        expect(where).toEqual({ updatedAt: { gt: data } });
    });

    it('ativo explícito vence o padrão, mesmo sem atualizadoDesde', () => {
        const where = {};
        aplicarAtivoOuDiferenca(where, { ativo: false });
        expect(where).toEqual({ ativo: false });
    });

    it('ativo explícito junto de atualizadoDesde aplica os dois filtros', () => {
        const data = new Date('2026-01-01T00:00:00Z');
        const where = {};
        aplicarAtivoOuDiferenca(where, { atualizadoDesde: data, ativo: true });
        expect(where).toEqual({ updatedAt: { gt: data }, ativo: true });
    });
});

describe('intervaloData', () => {
    const inicio = new Date('2026-01-01T00:00:00Z');
    const fim = new Date('2026-01-31T23:59:59Z');

    it('retorna undefined quando nem início nem fim foram informados', () => {
        expect(intervaloData(undefined, undefined)).toBeUndefined();
    });

    it('monta só gte quando só início foi informado', () => {
        expect(intervaloData(inicio, undefined)).toEqual({ gte: inicio });
    });

    it('monta só lte quando só fim foi informado', () => {
        expect(intervaloData(undefined, fim)).toEqual({ lte: fim });
    });

    it('monta gte e lte quando os dois foram informados', () => {
        expect(intervaloData(inicio, fim)).toEqual({ gte: inicio, lte: fim });
    });
});
