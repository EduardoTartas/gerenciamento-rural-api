import { describe, expect, it } from 'vitest';
import { SyncLoteSchema } from '../src/utils/validators/schemas/zod/SyncSchema.js';

describe('envelope do lote', () => {
    const valida = (extra = {}) => ({
        id: '11111111-1111-4111-8111-111111111111',
        entidade: 'pastos',
        acao: 'CREATE',
        entidadeId: '22222222-2222-4222-8222-222222222222',
        dados: { nome: 'Piquete Fundo' },
        ...extra,
    });

    it('aceita um lote bem formado', () => {
        const r = SyncLoteSchema.safeParse({ mutacoes: [valida()] });
        expect(r.success).toBe(true);
    });

    it('recusa lote vazio', () => {
        expect(SyncLoteSchema.safeParse({ mutacoes: [] }).success).toBe(false);
    });

    it('recusa mais de 100 mutações', () => {
        const muitas = Array.from({ length: 101 }, (_, i) => ({
            ...valida(),
            id: `1111111${String(i).padStart(4, '0')}-1111-4111-8111-111111111111`,
        }));
        expect(SyncLoteSchema.safeParse({ mutacoes: muitas }).success).toBe(false);
    });

    it('recusa ação fora do conjunto', () => {
        const r = SyncLoteSchema.safeParse({ mutacoes: [valida({ acao: 'UPSERT' })] });
        expect(r.success).toBe(false);
    });

    it('recusa id que não é uuid', () => {
        const r = SyncLoteSchema.safeParse({ mutacoes: [valida({ id: 'abc' })] });
        expect(r.success).toBe(false);
    });

    it('DELETE não precisa de dados', () => {
        const r = SyncLoteSchema.safeParse({
            mutacoes: [{ ...valida({ acao: 'DELETE' }), dados: undefined }],
        });
        expect(r.success).toBe(true);
    });

    it('CREATE com id dentro de dados é recusado', () => {
        // `entidadeId` é a fonte única do identificador. Dois lugares dizendo a
        // mesma coisa é origem de divergência silenciosa quando discordam.
        const r = SyncLoteSchema.safeParse({
            mutacoes: [valida({ dados: { nome: 'X', id: 'outro' } })],
        });
        expect(r.success).toBe(false);
    });
});
