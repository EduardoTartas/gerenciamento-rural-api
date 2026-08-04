import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * As regras que a banca vai perguntar: isolamento entre usuários, unicidade de
 * nome por propriedade, e a trava que impede esvaziar um pasto ocupado.
 */
describe('PastoService', () => {
    let service;

    const req = (usuarioId = 'dono') => ({ user: { id: usuarioId }, params: {}, query: {} });

    beforeEach(async () => {
        vi.doMock('../../src/config/dbConnect.js', () => ({ default: { prisma: {} } }));
        vi.resetModules();
        const { default: PastoService } = await import('../../src/service/PastoService.js');
        service = new PastoService();
    });

    it('recusa criar pasto em propriedade de outro usuário', async () => {
        // O repositório real filtra pelo dono na própria consulta; devolver
        // null é como ele responde quando a propriedade não é do usuário.
        service.propriedadeRepository = { findById: vi.fn().mockResolvedValue(null) };

        await expect(
            service.create({ propriedadeId: 'p1', nome: 'X' }, req('invasor')),
        ).rejects.toMatchObject({ errorType: 'resourceNotFound', statusCode: 404 });
    });

    it('recusa criar pasto em propriedade inativa', async () => {
        service.propriedadeRepository = {
            findById: vi.fn().mockResolvedValue({ id: 'p1', ativo: false }),
        };
        service.repository = { findByNome: vi.fn().mockResolvedValue(null) };

        await expect(
            service.create({ propriedadeId: 'p1', nome: 'X' }, req()),
        ).rejects.toMatchObject({ errorType: 'validationError', field: 'propriedadeId' });
    });

    it('recusa nome já usado na mesma propriedade', async () => {
        service.propriedadeRepository = {
            findById: vi.fn().mockResolvedValue({ id: 'p1', ativo: true }),
        };
        service.repository = {
            findByNome: vi.fn().mockResolvedValue({ id: 'outro', nome: 'Piquete Norte' }),
        };

        await expect(
            service.create({ propriedadeId: 'p1', nome: 'Piquete Norte' }, req()),
        ).rejects.toMatchObject({ errorType: 'conflict', statusCode: 409, field: 'nome' });
    });

    it('aceita o mesmo nome em outra propriedade', async () => {
        service.propriedadeRepository = {
            findById: vi.fn().mockResolvedValue({ id: 'p2', ativo: true }),
        };
        service.repository = {
            findByNome: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockResolvedValue({ id: 'novo' }),
        };

        await expect(
            service.create({ propriedadeId: 'p2', nome: 'Piquete Norte' }, req()),
        ).resolves.toMatchObject({ id: 'novo' });
    });

    it('recusa inativar pasto que ainda tem rebanho', async () => {
        service.repository = {
            findById: vi.fn().mockResolvedValue({ id: 'pasto1', propriedadeId: 'p1' }),
            countRebanhos: vi.fn().mockResolvedValue(2),
            update: vi.fn(),
        };

        await expect(
            service.update('pasto1', { ativo: false }, req()),
        ).rejects.toMatchObject({ errorType: 'validationError', field: 'ativo' });
        expect(service.repository.update).not.toHaveBeenCalled();
    });

    it('recusa marcar como Vazio um pasto ocupado', async () => {
        service.repository = {
            findById: vi.fn().mockResolvedValue({ id: 'pasto1', propriedadeId: 'p1' }),
            countRebanhos: vi.fn().mockResolvedValue(1),
            update: vi.fn(),
        };

        await expect(
            service.update('pasto1', { status: 'Vazio' }, req()),
        ).rejects.toMatchObject({ errorType: 'validationError', field: 'status' });
    });
});
