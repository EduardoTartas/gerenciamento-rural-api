import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import DbConnect from '../../../src/config/dbConnect.js';
import { criarUsuario } from '../../apoio/auth.js';
import { criarPropriedade, criarTipoInsumo, criarInsumo } from '../../apoio/fabricas.js';
import { criarMovimentacaoInsumo } from './apoio-local.js';

/**
 * O banco de teste já nasce migrado, então a conversão da migration
 * `estoque_sem_contagem` (issue #67) é exercitada assim: grava linhas no
 * formato antigo (a coluna é texto, o Prisma aceita) e roda o SQL da própria
 * migration sobre elas.
 */
const SQL = readFileSync(
    new URL('../../../prisma/migrations/20261005120000_estoque_sem_contagem/migration.sql', import.meta.url),
    'utf8',
);

async function rodarMigration() {
    const comandos = SQL
        .split(';')
        .map((c) => c.split('\n').filter((l) => !l.trim().startsWith('--')).join('\n').trim())
        .filter(Boolean);
    for (const comando of comandos) {
        await DbConnect.prisma.$executeRawUnsafe(comando);
    }
}

describe('migration estoque_sem_contagem', () => {
    let insumo;

    beforeEach(async () => {
        const a = await criarUsuario();
        const propriedade = await criarPropriedade(a.id);
        const tipoInsumo = await criarTipoInsumo();
        insumo = await criarInsumo(propriedade.id, { tipoInsumoId: tipoInsumo.id });
    });

    const ler = (id) => DbConnect.prisma.movimentacaoInsumo.findUnique({ where: { id } });

    it('MINS-MIG-01 converte contagens sem mudar o saldo', async () => {
        const antiga = new Date('2026-01-01T00:00:00Z');
        const compra = await criarMovimentacaoInsumo(insumo.id, { quantidade: 100, updatedAt: antiga });
        const paraCima = await criarMovimentacaoInsumo(insumo.id, {
            tipo: 'Ajuste', origem: 'AjusteContagem', quantidade: 5, observacoes: 'sobrou', updatedAt: antiga,
        });
        const paraBaixo = await criarMovimentacaoInsumo(insumo.id, {
            tipo: 'Ajuste', origem: 'AjusteContagem', quantidade: -12, updatedAt: antiga,
        });
        const zerada = await criarMovimentacaoInsumo(insumo.id, {
            tipo: 'Ajuste', origem: 'AjusteContagem', quantidade: 0, updatedAt: antiga,
        });
        const contagemComoSaida = await criarMovimentacaoInsumo(insumo.id, {
            tipo: 'Saida', origem: 'AjusteContagem', quantidade: 3, updatedAt: antiga,
        });

        await rodarMigration();

        const cima = await ler(paraCima.id);
        expect(cima.tipo).toBe('Entrada');
        expect(Number(cima.quantidade)).toBe(5);
        expect(cima.origem).toBe('Outro');
        expect(cima.observacoes).toBe('Ajuste de contagem (convertido) — sobrou');
        expect(cima.updatedAt.getTime()).toBeGreaterThan(antiga.getTime());

        const baixo = await ler(paraBaixo.id);
        expect(baixo.tipo).toBe('Saida');
        expect(Number(baixo.quantidade)).toBe(12);
        expect(baixo.observacoes).toBe('Ajuste de contagem (convertido)');

        const zero = await ler(zerada.id);
        expect(zero.ativo).toBe(false);
        expect(zero.tipo).toBe('Entrada');
        expect(zero.origem).toBe('Outro');

        const saida = await ler(contagemComoSaida.id);
        expect(saida.tipo).toBe('Saida');
        expect(saida.origem).toBe('Outro');

        // Compra não é contagem: fica intocada.
        const intocada = await ler(compra.id);
        expect(intocada.origem).toBe('Compra');
        expect(intocada.updatedAt.getTime()).toBe(antiga.getTime());

        // Saldo antes: 100 + 5 - 12 + 0 - 3 = 90. Depois, entradas - saídas ativas.
        const ativas = await DbConnect.prisma.movimentacaoInsumo.findMany({ where: { insumoId: insumo.id, ativo: true } });
        const saldo = ativas.reduce((t, m) => t + (m.tipo === 'Entrada' ? 1 : -1) * Number(m.quantidade), 0);
        expect(saldo).toBe(90);

        const restantes = await DbConnect.prisma.movimentacaoInsumo.count({
            where: { OR: [{ tipo: 'Ajuste' }, { origem: 'AjusteContagem' }] },
        });
        expect(restantes).toBe(0);
    });
});
