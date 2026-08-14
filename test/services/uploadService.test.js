import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('sharp', () => ({
    default: vi.fn(() => ({
        resize: vi.fn().mockReturnThis(),
        jpeg: vi.fn().mockReturnThis(),
        toBuffer: vi.fn().mockResolvedValue(Buffer.from('imagem-processada')),
    })),
}));

describe('UploadService', () => {
    let service;

    beforeEach(async () => {
        vi.resetModules();
        const { default: UploadService } = await import('../../src/service/UploadService.js');
        service = new UploadService();
        service.repository = {
            uploadFile: vi.fn().mockResolvedValue('https://garage.exemplo.com/pastolivre-avatars/foo.jpeg'),
            deleteFile: vi.fn().mockResolvedValue(undefined),
        };
    });

    const file = (overrides = {}) => ({
        name: 'avatar.jpg',
        mimetype: 'image/jpeg',
        size: 1024,
        data: Buffer.from('conteudo'),
        ...overrides,
    });

    it('recusa quando nenhum arquivo é enviado', async () => {
        await expect(service.processarImagem(null)).rejects.toMatchObject({
            errorType: 'validationError',
            field: 'file',
        });
    });

    it('recusa extensão fora da whitelist', async () => {
        await expect(
            service.processarImagem(file({ name: 'avatar.gif', mimetype: 'image/gif' })),
        ).rejects.toMatchObject({ errorType: 'validationError', field: 'file' });
    });

    it('recusa mimetype divergente da extensão (adulteração)', async () => {
        await expect(
            service.processarImagem(file({ mimetype: 'application/x-msdownload' })),
        ).rejects.toMatchObject({ errorType: 'validationError', field: 'file' });
    });

    it('recusa arquivo acima de 5MB', async () => {
        await expect(
            service.processarImagem(file({ size: 6 * 1024 * 1024 })),
        ).rejects.toMatchObject({ errorType: 'validationError', field: 'file' });
    });

    it('processa e envia imagem válida, retornando url e fileName', async () => {
        const resultado = await service.processarImagem(file());

        expect(resultado.url).toBe('https://garage.exemplo.com/pastolivre-avatars/foo.jpeg');
        expect(resultado.fileName).toMatch(/\.jpeg$/);
        expect(service.repository.uploadFile).toHaveBeenCalledWith(
            expect.any(Buffer),
            resultado.fileName,
            'image/jpeg',
        );
    });

    it('deletarImagem não chama o repository quando a url é vazia', async () => {
        await service.deletarImagem(null);
        expect(service.repository.deleteFile).not.toHaveBeenCalled();
    });

    it('deletarImagem delega ao repository', async () => {
        await service.deletarImagem('https://garage.exemplo.com/pastolivre-avatars/foo.jpeg');
        expect(service.repository.deleteFile).toHaveBeenCalledWith('https://garage.exemplo.com/pastolivre-avatars/foo.jpeg');
    });
});
