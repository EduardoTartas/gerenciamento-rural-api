import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('PropriedadeService', () => {
    let service;
    const req = (usuarioId = 'dono') => ({ user: { id: usuarioId }, params: {}, query: {} });

    beforeEach(async () => {
        vi.doMock('../../src/config/dbConnect.js', () => ({ default: { prisma: {} } }));
        vi.resetModules();
        const { default: PropriedadeService } = await import(
            '../../src/service/PropriedadeService.js'
        );
        service = new PropriedadeService();
    });

    it('devolve 404 para propriedade de outro usuário', async () => {
        service.repository = { findById: vi.fn().mockResolvedValue(null) };

        await expect(
            service.ensurePropriedadeExists('p1', 'invasor'),
        ).rejects.toMatchObject({ statusCode: 404 });
    });

    it('recusa nome duplicado com 409, não 400', async () => {
        // Antes o conflito saía como 400/validationError, e o cliente não
        // distinguia de dado malformado.
        service.repository = { findByNome: vi.fn().mockResolvedValue({ id: 'outra' }) };

        await expect(
            service.validateUniqueNome('Fazenda X', 'dono'),
        ).rejects.toMatchObject({ statusCode: 409, errorType: 'conflict' });
    });
});
