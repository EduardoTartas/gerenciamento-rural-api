import { readFile } from 'node:fs/promises';
import { beforeAll, describe, expect, it } from 'vitest';

/**
 * O delta só funciona se toda mudança deixar rastro. Uma linha apagada de
 * verdade não tem `updatedAt` para reportar: ela some, e o aplicativo fica com
 * um registro fantasma para sempre.
 */
describe('schema preparado para sincronização por diferença', () => {
    let schema;

    beforeAll(async () => {
        schema = await readFile('prisma/schema.prisma', 'utf8');
    });

    function corpoDoModelo(nome) {
        const match = schema.match(new RegExp(`model ${nome} \\{([\\s\\S]*?)\\n\\}`));
        expect(match, `modelo ${nome} não encontrado`).not.toBeNull();
        return match[1];
    }

    const sincronizadas = [
        'propriedade',
        'pasto',
        'rebanho',
        'manejoPasto',
        'manejoRebanho',
        'historicoMovimentacao',
    ];

    it.each(sincronizadas)('%s tem updatedAt', (modelo) => {
        expect(corpoDoModelo(modelo)).toMatch(/updatedAt\s+DateTime/);
    });

    it.each(sincronizadas)('%s tem ativo, para exclusão deixar rastro', (modelo) => {
        expect(corpoDoModelo(modelo)).toMatch(/ativo\s+Boolean/);
    });

    it.each(['pasto', 'rebanho'])('%s indexa (propriedadeId, updatedAt)', (modelo) => {
        expect(corpoDoModelo(modelo)).toMatch(/@@index\(\[propriedadeId, updatedAt\]\)/);
    });

    it('mutacaoAplicada existe com o que a idempotência precisa', () => {
        const corpo = corpoDoModelo('mutacaoAplicada');
        expect(corpo).toMatch(/id\s+String\s+@id/);
        expect(corpo).toMatch(/usuarioId\s+String/);
        expect(corpo).toMatch(/entidade\s+String/);
        expect(corpo).toMatch(/entidadeId\s+String/);
        expect(corpo).toMatch(/resultado\s+Json/);
        expect(corpo).toMatch(/aplicadaEm\s+DateTime/);
        expect(corpo).toMatch(/@@index\(\[usuarioId, aplicadaEm\]\)/);
    });
});
